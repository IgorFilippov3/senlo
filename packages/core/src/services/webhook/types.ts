// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Providers that call back with delivery events. */
export type WebhookProviderType = "RESEND" | "POSTMARK" | "SENDGRID" | "MAILJET" | "SES";

export type DeliveryEventType =
  | "DELIVERED"
  | "BOUNCE"
  | "SPAM_REPORT"
  | "OPEN"
  | "CLICK";

/**
 * One provider event in Senlo's terms. Every adapter produces this shape, so
 * the service applies an event the same way whichever provider sent it.
 *
 * `campaignId` and `contactId` are what the provider echoed back from the
 * tags set at send time: unverified hints that the service scopes to the
 * project before use.
 */
export interface DeliveryEvent {
  provider: WebhookProviderType;
  type: DeliveryEventType;
  providerMessageId: string;
  email: string;
  campaignId: number | null;
  contactId: number | null;
  /** Clicked link, for CLICK events that carry one. */
  url?: string;
  /** The provider's payload as received, kept on the log and the event. */
  raw: unknown;
}

/**
 * What a provider's webhook format looks like: where the project id sits in
 * the unverified body, how authenticity is checked, and how an event maps
 * to a `DeliveryEvent`.
 */
export interface WebhookAdapter {
  readonly type: WebhookProviderType;
  /**
   * For providers that post several events in one body (SendGrid, Mailjet): the
   * events of a parsed body, or null when the body is not a batch. Without
   * it the body is one event.
   */
  split?(body: unknown): unknown[] | null;
  /**
   * Reads the project id from the body (from one event of a batch) before
   * verification. It picks the
   * provider whose secret the event is checked against, nothing more.
   *
   * For provider-bound adapters (`providerIdFrom`) it is called on the
   * verified payload instead, after the handshake.
   */
  readProjectId(body: unknown): number | null;
  /**
   * For providers whose callbacks cannot name a project before they are
   * verified (SNS: the subscription handshake carries none). The provider is
   * then taken from the callback URL's query, its secret checks the body,
   * and the project read from the verified payload must use that provider.
   */
  providerIdFrom?(query: Record<string, string>): number | null;
  /**
   * Answers a subscription handshake carried in a verified payload. True
   * when the payload was one (nothing more to do), false for an ordinary
   * event. Throws when the handshake could not be completed, so the
   * provider retries it.
   */
  handshake?(payload: unknown): Promise<boolean>;
  /**
   * Checks the event against the provider's configured secret. Returns the
   * authenticated payload, or null when the check fails. May be async (Web
   * Crypto signature checks are).
   */
  verify(
    rawBody: string,
    headers: Record<string, string>,
    secret: string,
  ): unknown | null | Promise<unknown | null>;
  /**
   * Maps a verified payload to a common event. Null for events Senlo does
   * not track and for payloads missing the message id or the recipient.
   */
  normalize(payload: unknown): DeliveryEvent | null;
}

export type WebhookRejection =
  | "invalid_payload"
  | "secret_not_configured"
  | "invalid_signature";

export type WebhookResult =
  /** Verified and applied. */
  | { status: "processed"; event: DeliveryEvent }
  /**
   * A batch (SendGrid) of which at least one project's part verified. Parts
   * that did not are logged and dropped rather than refused: the provider
   * retries a refused batch whole, and the verified parts would be applied
   * twice.
   */
  | {
      status: "batch_processed";
      events: DeliveryEvent[];
      /**
       * Events of the batch not applied, for any reason: not tracked (open,
       * processed), incomplete, untagged, or in a part that did not verify.
       */
      notApplied: number;
    }
  /** Verified, or not addressed to a known project; nothing to do. Answered 200 so the provider stops retrying. */
  | { status: "ignored"; reason: string }
  /** Not authenticated, or not parseable. */
  | { status: "rejected"; reason: WebhookRejection };

export function parseId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
