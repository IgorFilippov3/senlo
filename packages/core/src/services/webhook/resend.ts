// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Webhook } from "svix";
import {
  isRecord,
  parseId,
  type DeliveryEvent,
  type DeliveryEventType,
  type WebhookAdapter,
} from "./types";

const EVENT_TYPES: Record<string, DeliveryEventType> = {
  "email.delivered": "DELIVERED",
  "email.bounced": "BOUNCE",
  "email.complained": "SPAM_REPORT",
  // Opens and clicks are counted by Senlo's own tracking links; Resend's
  // `email.opened` / `email.clicked` would count them twice.
};

/**
 * Resend sends tags either as `{ name, value }` pairs or as a plain object,
 * depending on the event.
 */
export function readResendTags(data: unknown): Record<string, string> {
  if (!isRecord(data)) return {};
  const raw = data.tags;
  const tags: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const tag of raw) {
      if (isRecord(tag) && typeof tag.name === "string" && "value" in tag) {
        tags[tag.name] = String(tag.value);
      }
    }
  } else if (isRecord(raw)) {
    for (const [key, value] of Object.entries(raw)) tags[key] = String(value);
  }
  return tags;
}

/** Resend signs with svix; the secret is the endpoint's signing secret. */
export const resendWebhookAdapter: WebhookAdapter = {
  type: "RESEND",

  readProjectId(body) {
    if (!isRecord(body)) return null;
    return parseId(readResendTags(body.data).project_id);
  },

  verify(rawBody, headers, secret) {
    try {
      return new Webhook(secret).verify(rawBody, headers);
    } catch {
      return null;
    }
  },

  normalize(payload): DeliveryEvent | null {
    if (!isRecord(payload) || typeof payload.type !== "string") return null;
    const type = EVENT_TYPES[payload.type];
    if (!type) return null;

    const data = isRecord(payload.data) ? payload.data : {};
    const providerMessageId =
      typeof data.email_id === "string" ? data.email_id : null;
    const email = Array.isArray(data.to) ? data.to[0] : null;
    if (!providerMessageId || typeof email !== "string" || !email) return null;

    const tags = readResendTags(data);
    return {
      provider: "RESEND",
      type,
      providerMessageId,
      email,
      campaignId: parseId(tags.campaign_id),
      contactId: parseId(tags.contact_id),
      raw: payload,
    };
  },
};
