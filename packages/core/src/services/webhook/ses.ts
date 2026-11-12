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
import {
  createSnsVerifier,
  fetchSnsUrl,
  isSnsUrl,
  parseSnsEnvelope,
  snsUrlRegion,
  topicRegion,
  type SnsEnvelope,
  type SnsFetch,
  type SnsVerifier,
} from "./sns";

/**
 * Amazon SES events, published by a configuration set to an SNS topic and
 * delivered by SNS over HTTPS to `/api/webhooks/ses?provider=<id>`.
 *
 * The "secret" stored on an SES provider is the SNS topic ARN. A message is
 * accepted only when it is signed by SNS (see `sns.ts`) and comes from that
 * topic: a signature alone proves SNS sent it, not whose topic, and any AWS
 * account can subscribe this endpoint to a topic of its own.
 *
 * The callback URL names the provider because the subscription handshake
 * carries no project. Events name their project in the `project_id` message
 * tag set at send time; the service checks it against the provider.
 */

/** Event publishing types Senlo applies; the rest are ignored. */
type SesEvent = Record<string, unknown> & { eventType: string; mail: Record<string, unknown> };

function sesEvent(payload: unknown): SesEvent | null {
  const env = payload as SnsEnvelope | null;
  if (!env || env.Type !== "Notification") return null;
  let message: unknown;
  try {
    message = JSON.parse(env.Message);
  } catch {
    return null;
  }
  if (!isRecord(message) || typeof message.eventType !== "string" || !isRecord(message.mail)) return null;
  return message as SesEvent;
}

/** First value of a message tag (`mail.tags` maps a name to a list of values). */
function tag(event: SesEvent, name: string): string | null {
  const tags = event.mail.tags;
  if (!isRecord(tags)) return null;
  const values = tags[name];
  return Array.isArray(values) && typeof values[0] === "string" ? values[0] : null;
}

function firstAddress(list: unknown, key?: string): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  if (key) return isRecord(item) && typeof item[key] === "string" ? (item[key] as string) : null;
  return typeof item === "string" ? item : null;
}

/** The Senlo event type and the recipient it is about, or null when not applied. */
function classify(event: SesEvent): { type: DeliveryEventType; email: string | null } | null {
  const fallback = firstAddress(event.mail.destination);
  switch (event.eventType) {
    case "Delivery": {
      const delivery = isRecord(event.delivery) ? event.delivery : {};
      return { type: "DELIVERED", email: firstAddress(delivery.recipients) ?? fallback };
    }
    case "Bounce": {
      const bounce = isRecord(event.bounce) ? event.bounce : {};
      // Transient (mailbox full, auto-reply) and Undetermined are not dead
      // addresses: suppressing them would block a good recipient for good.
      if (bounce.bounceType !== "Permanent") return null;
      return { type: "BOUNCE", email: firstAddress(bounce.bouncedRecipients, "emailAddress") ?? fallback };
    }
    case "Complaint": {
      const complaint = isRecord(event.complaint) ? event.complaint : {};
      if (complaint.complaintFeedbackType === "not-spam") return null;
      return {
        type: "SPAM_REPORT",
        email: firstAddress(complaint.complainedRecipients, "emailAddress") ?? fallback,
      };
    }
    // Send, Reject (the sender's problem), Open and Click (Senlo tracks its
    // own), RenderingFailure, DeliveryDelay, Subscription.
    default:
      return null;
  }
}

/**
 * A SubscribeURL Senlo will GET: an SNS host in the topic's own region,
 * confirming exactly this topic. It is signed, so this only guards against
 * surprises in what SNS sends.
 */
function isConfirmationUrl(env: SnsEnvelope): boolean {
  const url = env.SubscribeURL;
  if (!url || !isSnsUrl(url)) return false;
  if (snsUrlRegion(url) !== topicRegion(env.TopicArn)) return false;
  const params = new URL(url).searchParams;
  return params.get("Action") === "ConfirmSubscription" && params.get("TopicArn") === env.TopicArn;
}

export interface SesWebhookOptions {
  /** Signature check; defaults to one that fetches certificates with `fetch`. */
  sns?: SnsVerifier;
  /** GET used for certificates (when `sns` is not given) and for the SubscribeURL. */
  fetch?: SnsFetch;
}

export function createSesWebhookAdapter(options: SesWebhookOptions = {}): WebhookAdapter {
  const fetchText = options.fetch ?? fetchSnsUrl;
  const sns = options.sns ?? createSnsVerifier({ fetch: fetchText });

  return {
    type: "SES",

    providerIdFrom(query) {
      return parseId(query.provider);
    },

    readProjectId(payload) {
      const event = sesEvent(payload);
      return event ? parseId(tag(event, "project_id")) : null;
    },

    async verify(rawBody, _headers, topicArn) {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return null;
      }
      const env = parseSnsEnvelope(body);
      // The topic is compared first: a message from someone else's topic
      // never makes the server fetch a certificate.
      if (!env || env.TopicArn !== topicArn.trim()) return null;
      return (await sns.verify(env)) ? env : null;
    },

    async handshake(payload) {
      const env = payload as SnsEnvelope;
      if (env.Type === "Notification") return false;
      // Someone unsubscribed the endpoint in AWS: nothing to do, and not
      // re-subscribing is the point.
      if (env.Type === "UnsubscribeConfirmation") return true;
      if (!isConfirmationUrl(env)) {
        throw new Error("SNS SubscribeURL is not a confirmation for this topic");
      }
      await fetchText(env.SubscribeURL!);
      return true;
    },

    normalize(payload): DeliveryEvent | null {
      const event = sesEvent(payload);
      if (!event) return null;
      const classified = classify(event);
      if (!classified) return null;
      const providerMessageId = typeof event.mail.messageId === "string" ? event.mail.messageId : null;
      if (!providerMessageId || !classified.email) return null;

      return {
        provider: "SES",
        type: classified.type,
        providerMessageId,
        email: classified.email,
        campaignId: parseId(tag(event, "campaign_id")),
        contactId: parseId(tag(event, "contact_id")),
        raw: event,
      };
    },
  };
}

export const sesWebhookAdapter = createSesWebhookAdapter();
