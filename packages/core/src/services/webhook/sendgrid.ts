// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  isRecord,
  parseId,
  type DeliveryEvent,
  type DeliveryEventType,
  type WebhookAdapter,
} from "./types";

export const SENDGRID_SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
export const SENDGRID_TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

const EVENT_TYPES: Record<string, DeliveryEventType> = {
  delivered: "DELIVERED",
  bounce: "BOUNCE",
  spamreport: "SPAM_REPORT",
  // `dropped` is mapped by its reason, below. Opens and clicks are counted
  // by Senlo's own tracking; SendGrid's are switched off at send time.
};

/**
 * `dropped` reasons that are about the recipient's address. The others
 * ("Invalid SMTPAPI header", "Spam Content", "Recipient List over Package
 * Quota", "Invalid", which is usually a broken template) are the sender's
 * problem: suppressing the address for them would block a good recipient
 * for good. "Unsubscribed Address" is left out too: it comes from
 * SendGrid's own unsubscribe lists, Senlo keeps its own, and recording it as
 * a bounce would be wrong.
 */
const DROPPED_REASONS: Record<string, DeliveryEventType> = {
  "bounced address": "BOUNCE",
  "invalid address": "BOUNCE",
  "spam reporting address": "SPAM_REPORT",
};

/**
 * How old a signed batch may be. SendGrid retries failed deliveries for up
 * to 24 hours and its docs do not say whether a retry is signed anew, so the
 * window covers the whole retry period: a shorter one could refuse every
 * retry after an outage and lose those events. Replays inside the window
 * are a matter for deduplication by `sg_event_id`.
 */
export const SENDGRID_MAX_AGE_SECONDS = 25 * 60 * 60;
/** Clock skew allowed for a timestamp from the future. */
export const SENDGRID_MAX_SKEW_SECONDS = 5 * 60;

function eventType(event: Record<string, unknown>): DeliveryEventType | null {
  if (event.event === "dropped") {
    const reason = typeof event.reason === "string" ? event.reason.trim().toLowerCase() : "";
    return DROPPED_REASONS[reason] ?? null;
  }
  // `blocked` is a temporary refusal by the receiving server (an IP on a
  // blocklist, a rate limit), not a dead address: no suppression.
  if (event.event === "bounce" && event.type === "blocked") return null;
  return typeof event.event === "string" ? (EVENT_TYPES[event.event] ?? null) : null;
}

/** The timestamp header is seconds since the epoch, within the window. */
export function isFreshTimestamp(timestamp: string, nowMs = Date.now()): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  const age = Math.floor(nowMs / 1000) - Number(timestamp);
  return age <= SENDGRID_MAX_AGE_SECONDS && age >= -SENDGRID_MAX_SKEW_SECONDS;
}

/**
 * `sg_message_id` is the `X-Message-Id` returned at send time plus a
 * `.filter…` suffix of SendGrid's own.
 */
export function sendGridMessageId(sgMessageId: string): string {
  const at = sgMessageId.indexOf(".filter");
  return at === -1 ? sgMessageId : sgMessageId.slice(0, at);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The verification key as SendGrid shows it (base64 SPKI), PEM armor allowed. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  return base64ToBytes(key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
}

/**
 * SendGrid's signature is DER (`SEQUENCE { INTEGER r, INTEGER s }`); Web
 * Crypto wants r and s as two 32-byte halves. Null when it is not that shape.
 */
export function derToP1363(der: Uint8Array): Uint8Array<ArrayBuffer> | null {
  let pos = 0;
  const readLength = (): number | null => {
    if (pos >= der.length) return null;
    let len = der[pos++];
    if (len & 0x80) {
      const bytes = len & 0x7f;
      if (bytes < 1 || bytes > 2) return null;
      len = 0;
      for (let i = 0; i < bytes; i++) {
        if (pos >= der.length) return null;
        len = (len << 8) | der[pos++];
      }
    }
    return len;
  };
  const readInt = (): Uint8Array | null => {
    if (der[pos++] !== 0x02) return null;
    const len = readLength();
    if (len === null || len < 1 || pos + len > der.length) return null;
    let int = der.subarray(pos, pos + len);
    pos += len;
    while (int.length > 1 && int[0] === 0) int = int.subarray(1);
    return int.length > 32 ? null : int;
  };

  if (der[pos++] !== 0x30) return null;
  const seqLen = readLength();
  if (seqLen === null || pos + seqLen !== der.length) return null;
  const r = readInt();
  const s = readInt();
  if (!r || !s || pos !== der.length) return null;

  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

/**
 * SendGrid's Signed Event Webhook: ECDSA P-256 / SHA-256 over the timestamp
 * header followed by the raw body. The "secret" stored in Senlo is the
 * webhook's verification key (public, but it decides which events are
 * accepted, so it is stored like the other secrets).
 *
 * Events arrive in batches, and custom args set at send time come back as
 * top-level fields of each event.
 */
export const sendGridWebhookAdapter: WebhookAdapter = {
  type: "SENDGRID",

  split(body) {
    return Array.isArray(body) ? body : null;
  },

  readProjectId(event) {
    return isRecord(event) ? parseId(event.project_id) : null;
  },

  async verify(rawBody, headers, key) {
    const signature = headers[SENDGRID_SIGNATURE_HEADER];
    const timestamp = headers[SENDGRID_TIMESTAMP_HEADER];
    if (!signature || !timestamp || !isFreshTimestamp(timestamp)) return null;
    try {
      const raw = derToP1363(base64ToBytes(signature));
      if (!raw) return null;
      const publicKey = await globalThis.crypto.subtle.importKey(
        "spki",
        keyBytes(key),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      const ok = await globalThis.crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        raw,
        new TextEncoder().encode(timestamp + rawBody),
      );
      return ok ? (JSON.parse(rawBody) as unknown) : null;
    } catch {
      return null;
    }
  },

  normalize(event): DeliveryEvent | null {
    if (!isRecord(event)) return null;
    const type = eventType(event);
    if (!type) return null;

    const providerMessageId =
      typeof event.sg_message_id === "string" ? sendGridMessageId(event.sg_message_id) : null;
    const email = typeof event.email === "string" ? event.email : null;
    if (!providerMessageId || !email) return null;

    return {
      provider: "SENDGRID",
      type,
      providerMessageId,
      email,
      campaignId: parseId(event.campaign_id),
      contactId: parseId(event.contact_id),
      raw: event,
    };
  },
};
