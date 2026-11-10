// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { Contact } from "../domain";
import { NotFoundError } from "../errors";
import type { ContactRepository, IContactEventRepository } from "../ports";
import { parseInput } from "../validation";
import {
  EVENT_NAME_PATTERN,
  MAX_EVENT_PAYLOAD_BYTES,
  MAX_IDEMPOTENCY_KEY_LENGTH,
} from "../workflow-events";
import type { AudienceService } from "./audienceService";
import type { AutomationService } from "./automationService";

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Body of `POST /api/events`. */
export const EventRequestSchema = z
  .object({
    /** A system event (`SYSTEM_EVENT_TYPES`) or any custom name. */
    event: z
      .string()
      .trim()
      .regex(
        EVENT_NAME_PATTERN,
        "Event name: lowercase letters, digits and _ . : -, starting with a letter or digit, 64 characters at most",
      ),
    email: z.string().trim().min(1, "Email is required").email(),
    name: z.string().optional(),
    locale: z.string().optional(),
    /** Contact attributes, merged into the contact. Never part of the event. */
    metadata: z.record(z.unknown()).optional(),
    /** The event's own data: `{{event.*}}` in emails, trigger filters. Not stored on the contact. */
    payload: z
      .record(z.unknown())
      .optional()
      .refine((p) => p === undefined || jsonBytes(p) <= MAX_EVENT_PAYLOAD_BYTES, {
        message: `Payload must be at most ${MAX_EVENT_PAYLOAD_BYTES / 1024} KB of JSON`,
      }),
    /** Same as the `Idempotency-Key` header, which wins when both are sent. */
    idempotencyKey: z.string().trim().min(1).max(MAX_IDEMPOTENCY_KEY_LENGTH).optional(),
  })
  .superRefine((req, ctx) => {
    if (req.event !== "tag_added") return;
    const tags = req.payload?.tags;
    const valid =
      Array.isArray(tags) && tags.length > 0 && tags.every((t) => typeof t === "string" && t.trim() !== "");
    if (!valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "tag_added needs payload.tags: a non-empty array of strings",
      });
    }
  });

export type EventRequest = z.infer<typeof EventRequestSchema>;

export interface IngestResult {
  event: EventRequest;
  /** The contact as it is afterwards. */
  contact: Contact;
  /** The idempotency key was seen before: nothing was changed or dispatched. */
  duplicate: boolean;
}

type Meta = Record<string, unknown>;

function metaOf(contact: Contact): Meta {
  return (contact.meta as Meta | null | undefined) ?? {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The public events API. Each event identifies a contact by email, applies
 * its side effect (system events) or finds/creates the contact (custom
 * events), merges `metadata` into the contact's attributes, then is stored
 * and dispatched to automations. The project comes from the API key that
 * authenticated the request, never from the body.
 */
export class EventIngestionService {
  constructor(
    private readonly contacts: Pick<ContactRepository, "findByEmail" | "findById" | "update">,
    private readonly events: Pick<IContactEventRepository, "findByIdempotencyKey">,
    private readonly audience: Pick<AudienceService, "createContact">,
    private readonly automation: Pick<AutomationService, "handleEvent">,
  ) {}

  /** `rawBody` is the request body as received; `idempotencyKey` the `Idempotency-Key` header, if any. */
  async ingest(
    projectId: number,
    rawBody: unknown,
    options: { idempotencyKey?: string | null } = {},
  ): Promise<IngestResult> {
    const body =
      options.idempotencyKey != null && isObject(rawBody)
        ? { ...rawBody, idempotencyKey: options.idempotencyKey }
        : rawBody;
    const event = parseInput(EventRequestSchema, body);

    if (event.idempotencyKey) {
      const seen = await this.events.findByIdempotencyKey(projectId, event.idempotencyKey);
      if (seen) {
        const contact = await this.contacts.findById(seen.contactId);
        if (!contact) throw new NotFoundError("Contact");
        return { event, contact, duplicate: true };
      }
    }

    const { contact, duplicate } = await this.apply(projectId, event);
    return { event, contact, duplicate };
  }

  private async apply(projectId: number, req: EventRequest): Promise<{ contact: Contact; duplicate: boolean }> {
    const payload = req.payload ?? {};

    switch (req.event) {
      case "contact_added": {
        // The audience service fires `contact_added` itself, for every source.
        const contact = await this.audience.createContact(
          { projectId, email: req.email, name: req.name, locale: req.locale, meta: req.metadata },
          { payload, idempotencyKey: req.idempotencyKey },
        );
        return { contact, duplicate: false };
      }

      case "contact_updated": {
        const contact = await this.mergeAttributes(await this.requireContact(projectId, req.email), req);
        return this.dispatch(projectId, contact, req, payload);
      }

      case "tag_added": {
        const existing = await this.requireContact(projectId, req.email);
        const current = metaOf(existing);
        const currentTags = Array.isArray(current.tags) ? current.tags : [];
        const tags = (payload.tags as string[]).map((t) => t.trim());
        const contact = await this.mergeAttributes(existing, req, {
          tags: Array.from(new Set([...currentTags, ...tags])),
        });
        return this.dispatch(projectId, contact, req, { ...payload, tags });
      }

      default: {
        // A custom event: the contact is created when missing (which fires
        // `contact_added` for it first), otherwise its attributes are merged.
        const known = await this.contacts.findByEmail(projectId, req.email);
        const contact = known
          ? await this.mergeAttributes(known, req)
          : await this.audience.createContact({
              projectId,
              email: req.email,
              name: req.name,
              locale: req.locale,
              meta: req.metadata,
            });
        return this.dispatch(projectId, contact, req, payload);
      }
    }
  }

  /** `name`, `locale` and `metadata` (plus `extra` attributes) onto the contact; no write when nothing changes. */
  private async mergeAttributes(contact: Contact, req: EventRequest, extra?: Meta): Promise<Contact> {
    if (req.name === undefined && req.locale === undefined && !req.metadata && !extra) return contact;
    const updated = await this.contacts.update(contact.id, {
      name: req.name,
      locale: req.locale,
      meta: { ...metaOf(contact), ...req.metadata, ...extra },
    });
    return updated ?? contact;
  }

  private async requireContact(projectId: number, email: string): Promise<Contact> {
    const contact = await this.contacts.findByEmail(projectId, email);
    if (!contact) throw new NotFoundError("Contact");
    return contact;
  }

  private async dispatch(
    projectId: number,
    contact: Contact,
    req: EventRequest,
    payload: Record<string, unknown>,
  ): Promise<{ contact: Contact; duplicate: boolean }> {
    const { duplicate } = await this.automation.handleEvent({
      projectId,
      contactId: contact.id,
      name: req.event,
      payload,
      idempotencyKey: req.idempotencyKey,
    });
    return { contact, duplicate };
  }
}
