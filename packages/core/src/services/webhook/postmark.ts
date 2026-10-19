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

/** Header the shared secret travels in; set on the webhook in Postmark. */
export const POSTMARK_SECRET_HEADER = "x-postmark-secret";

const RECORD_TYPES: Record<string, DeliveryEventType> = {
  Delivery: "DELIVERED",
  Bounce: "BOUNCE",
  SpamComplaint: "SPAM_REPORT",
  Open: "OPEN",
  Click: "CLICK",
};

function readMetadata(body: unknown): Record<string, unknown> {
  return isRecord(body) && isRecord(body.Metadata) ? body.Metadata : {};
}

/**
 * Postmark does not sign webhooks; authenticity rests on a shared secret in
 * a custom header. The body is parsed before verification only to find the
 * project, and is trusted only after the header matched.
 */
export const postmarkWebhookAdapter: WebhookAdapter = {
  type: "POSTMARK",

  readProjectId(body) {
    return parseId(readMetadata(body).project_id);
  },

  verify(rawBody, headers, secret) {
    const received = headers[POSTMARK_SECRET_HEADER];
    if (!received || !constantTimeEqual(secret, received)) return null;
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  },

  normalize(payload): DeliveryEvent | null {
    if (!isRecord(payload) || typeof payload.RecordType !== "string") return null;
    const type = RECORD_TYPES[payload.RecordType];
    if (!type) return null;

    const providerMessageId =
      typeof payload.MessageID === "string" ? payload.MessageID : null;
    const email =
      typeof payload.Recipient === "string"
        ? payload.Recipient
        : typeof payload.Email === "string"
          ? payload.Email
          : null;
    if (!providerMessageId || !email) return null;

    const metadata = readMetadata(payload);
    return {
      provider: "POSTMARK",
      type,
      providerMessageId,
      email,
      campaignId: parseId(metadata.campaign_id),
      contactId: parseId(metadata.contact_id),
      url:
        typeof payload.OriginalLink === "string" ? payload.OriginalLink : undefined,
      raw: payload,
    };
  },
};
