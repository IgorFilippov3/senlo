// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { Contact, WorkflowEventType } from "../domain";
import { NotFoundError } from "../errors";
import type { ContactRepository } from "../ports";
import { parseInput } from "../validation";
import type { AudienceService } from "./audienceService";
import type { AutomationService } from "./automationService";

export const WORKFLOW_EVENT_TYPES = [
  "contact_added",
  "contact_updated",
  "tag_added",
  "order_created",
  "event_triggered",
] as const satisfies readonly WorkflowEventType[];

/** Body of `POST /api/events`. */
export const EventRequestSchema = z.object({
  event: z.enum(WORKFLOW_EVENT_TYPES),
  email: z.string().trim().min(1, "Email is required").email(),
  name: z.string().optional(),
  locale: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EventRequest = z.infer<typeof EventRequestSchema>;

type Meta = Record<string, unknown>;

function metaOf(contact: Contact): Meta {
  return (contact.meta as Meta | null | undefined) ?? {};
}

/**
 * The public events API: each event updates the project's contact and
 * starts the workflows listening for it. The project comes from the API key
 * that authenticated the request, never from the body.
 */
export class EventIngestionService {
  constructor(
    private readonly contacts: Pick<ContactRepository, "findByEmail" | "update">,
    private readonly audience: Pick<AudienceService, "createContact">,
    private readonly automation: Pick<AutomationService, "triggerEvent">,
  ) {}

  /** `rawBody` is the request body as received. Returns the contact as it is afterwards. */
  async ingest(projectId: number, rawBody: unknown): Promise<{ event: EventRequest; contact: Contact }> {
    const event = parseInput(EventRequestSchema, rawBody);
    const contact = await this.apply(projectId, event);
    return { event, contact };
  }

  private async apply(projectId: number, req: EventRequest): Promise<Contact> {
    switch (req.event) {
      case "contact_added":
        return this.audience.createContact({
          projectId,
          email: req.email,
          name: req.name,
          locale: req.locale,
          meta: req.metadata,
        });

      case "contact_updated": {
        const contact = await this.requireContact(projectId, req.email);
        const updated = await this.contacts.update(contact.id, {
          name: req.name,
          locale: req.locale,
          meta: { ...metaOf(contact), ...req.metadata },
        });
        await this.trigger(projectId, contact.id, req);
        return updated ?? contact;
      }

      case "tag_added": {
        const contact = await this.requireContact(projectId, req.email);
        const current = metaOf(contact);
        const currentTags = Array.isArray(current.tags) ? current.tags : [];
        const newTags = Array.isArray(req.metadata?.tags) ? req.metadata.tags : [];
        const updated = await this.contacts.update(contact.id, {
          meta: { ...current, tags: Array.from(new Set([...currentTags, ...newTags])) },
        });
        await this.trigger(projectId, contact.id, req);
        return updated ?? contact;
      }

      case "order_created":
      case "event_triggered": {
        const contact =
          (await this.contacts.findByEmail(projectId, req.email)) ??
          (await this.audience.createContact({
            projectId,
            email: req.email,
            name: req.name,
            locale: req.locale,
            meta: req.metadata,
          }));
        await this.trigger(projectId, contact.id, req);
        return contact;
      }
    }
  }

  private async requireContact(projectId: number, email: string): Promise<Contact> {
    const contact = await this.contacts.findByEmail(projectId, email);
    if (!contact) throw new NotFoundError("Contact");
    return contact;
  }

  private trigger(projectId: number, contactId: number, req: EventRequest) {
    return this.automation.triggerEvent({
      event: req.event,
      projectId,
      contactId,
      metadata: req.metadata,
    });
  }
}
