// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { constantTimeEqual } from "../../signing";
import {
  isRecord,
  parseId,
  type DeliveryEvent,
  type DeliveryEventType,
  type WebhookAdapter,
} from "./types";

/**
 * `bounce` and `blocked` errors that are about the recipient's address,
 * keyed `error_related_to/error`. Everything else (a full mailbox,
 * greylisting, a refused relay, content or spam filters, Mailjet's own
 * system errors, "duplicate in campaign") is temporary or the sender's
 * problem, and suppressing the address for it would block a good recipient.
 */
const ADDRESS_ERRORS: Record<string, DeliveryEventType> = {
  "recipient/user unknown": "BOUNCE",
  "recipient/mailbox inactive": "BOUNCE",
  "recipient/blacklisted": "BOUNCE",
  "recipient/spam reporter": "SPAM_REPORT",
  "domain/invalid domain": "BOUNCE",
  "domain/no mail host": "BOUNCE",
  "domain/typofix": "BOUNCE",
  // The address bounced recently or repeatedly; Mailjet did not try it.
  "mailjet/preblocked": "BOUNCE",
};

function addressError(event: Record<string, unknown>): DeliveryEventType | null {
  const relatedTo = typeof event.error_related_to === "string" ? event.error_related_to : "";
  const error = typeof event.error === "string" ? event.error : "";
  return ADDRESS_ERRORS[`${relatedTo}/${error}`.toLowerCase().trim()] ?? null;
}

function eventType(event: Record<string, unknown>): DeliveryEventType | null {
  switch (event.event) {
    // Accepted by the recipient's server.
    case "sent":
      return "DELIVERED";
    case "spam":
      return "SPAM_REPORT";
    case "bounce":
      // A soft bounce is retried by Mailjet; only a permanent one counts.
      return event.hard_bounce === true ? addressError(event) : null;
    case "blocked":
      return addressError(event);
    // `open`, `click` and `unsub` are Senlo's own: its tracking and its
    // unsubscribe links. Mailjet's tracking is switched off at send time.
    default:
      return null;
  }
}

/** The tags set at send time, sent back as the `Payload` string. */
export function readMailjetPayload(event: unknown): Record<string, unknown> {
  if (!isRecord(event) || typeof event.Payload !== "string" || !event.Payload) return {};
  try {
    const payload = JSON.parse(event.Payload) as unknown;
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

/** The password of a `Basic` Authorization header, or null. */
export function readBasicPassword(header: string | undefined): string | null {
  const match = header ? /^Basic\s+(\S+)$/i.exec(header.trim()) : null;
  if (!match) return null;
  try {
    const decoded = atob(match[1]);
    const colon = decoded.indexOf(":");
    return colon === -1 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

/**
 * Mailjet does not sign webhooks. Its documented way to secure them is
 * basic auth in the callback URL (`https://senlo:<secret>@host/...`), which
 * arrives as an `Authorization: Basic` header; the password is checked
 * against the webhook secret, the user name is not used.
 *
 * Events come one per request, or as an array when "Group events" (callback
 * version 2) is on; both are accepted.
 */
export const mailjetWebhookAdapter: WebhookAdapter = {
  type: "MAILJET",

  split(body) {
    if (Array.isArray(body)) return body;
    return isRecord(body) ? [body] : null;
  },

  readProjectId(event) {
    return parseId(readMailjetPayload(event).project_id);
  },

  verify(rawBody, headers, secret) {
    const password = readBasicPassword(headers.authorization);
    if (password === null || !constantTimeEqual(secret, password)) return null;
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  },

  normalize(event): DeliveryEvent | null {
    if (!isRecord(event)) return null;
    const type = eventType(event);
    if (!type) return null;

    // `Message_GUID` is the `MessageUUID` returned at send time. The numeric
    // `MessageID` is not used: it is often above 2^53 and has already lost
    // digits in JSON.parse.
    const providerMessageId =
      typeof event.Message_GUID === "string" && event.Message_GUID ? event.Message_GUID : null;
    const email = typeof event.email === "string" ? event.email : null;
    if (!providerMessageId || !email) return null;

    const payload = readMailjetPayload(event);
    return {
      provider: "MAILJET",
      type,
      providerMessageId,
      email,
      campaignId: parseId(payload.campaign_id),
      contactId: parseId(payload.contact_id),
      raw: event,
    };
  },
};
