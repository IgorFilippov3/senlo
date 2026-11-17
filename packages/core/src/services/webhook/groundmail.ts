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

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, keyed with the endpoint's secret. */
export const GROUNDMAIL_SIGNATURE_HEADER = "groundmail-signature";

/** How far the signed timestamp may be from the clock, either way. */
export const GROUNDMAIL_TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads `t` and `v1` from the signature header, or null when either is missing. */
export function parseGroundmailSignature(header: string | undefined): { timestamp: number; signature: string } | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const at = part.indexOf("=");
    if (at > 0) parts[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  if (!/^\d+$/.test(parts.t ?? "") || !/^[0-9a-f]+$/i.test(parts.v1 ?? "")) return null;
  return { timestamp: Number(parts.t), signature: parts.v1.toLowerCase() };
}

export async function signGroundmailPayload(secret: string, timestamp: number, rawBody: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)));
}

/** Groundmail sends tags as `{ name, value }` pairs, or as the object they were sent as. */
export function readGroundmailTags(data: unknown): Record<string, string> {
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

/**
 * `email.bounced` with `bounce_type: "block"` means the receiving server
 * refused the sender, not the address: the address can still receive, so it
 * is not suppressed. Any other bounce type counts as hard. `email.failed`
 * counts only when it is a hard failure to the address. Opens and clicks are
 * counted by Senlo's own tracking, so Groundmail's would count them twice.
 */
function eventType(type: string, data: Record<string, unknown>): DeliveryEventType | null {
  switch (type) {
    case "email.delivered":
      return "DELIVERED";
    case "email.bounced":
      return data.bounce_type === "block" ? null : "BOUNCE";
    case "email.failed":
      return data.bounce_type === "hard" ? "BOUNCE" : null;
    case "email.complained":
      return "SPAM_REPORT";
    default:
      return null;
  }
}

export const groundmailWebhookAdapter: WebhookAdapter = {
  type: "GROUNDMAIL",

  readProjectId(body) {
    if (!isRecord(body)) return null;
    return parseId(readGroundmailTags(body.data).project_id);
  },

  async verify(rawBody, headers, secret) {
    const parsed = parseGroundmailSignature(headers[GROUNDMAIL_SIGNATURE_HEADER]);
    if (!parsed) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp) > GROUNDMAIL_TOLERANCE_SECONDS) return null;
    const expected = await signGroundmailPayload(secret, parsed.timestamp, rawBody);
    if (!constantTimeEqual(expected, parsed.signature)) return null;
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  },

  normalize(payload): DeliveryEvent | null {
    if (!isRecord(payload) || typeof payload.type !== "string") return null;
    const data = isRecord(payload.data) ? payload.data : {};
    const type = eventType(payload.type, data);
    if (!type) return null;

    const providerMessageId = typeof data.email_id === "string" ? data.email_id : null;
    const email = Array.isArray(data.to) ? data.to[0] : null;
    if (!providerMessageId || typeof email !== "string" || !email) return null;

    const tags = readGroundmailTags(data);
    return {
      provider: "GROUNDMAIL",
      type,
      providerMessageId,
      email,
      campaignId: parseId(tags.campaign_id),
      contactId: parseId(tags.contact_id),
      raw: payload,
    };
  },
};
