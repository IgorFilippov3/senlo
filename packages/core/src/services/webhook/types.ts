// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Providers that call back with delivery events. */
export type WebhookProviderType = "RESEND" | "POSTMARK";

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
   * Reads the project id from the body before verification. It picks the
   * provider whose secret the event is checked against, nothing more.
   */
  readProjectId(body: unknown): number | null;
  /**
   * Checks the event against the provider's configured secret. Returns the
   * authenticated payload, or null when the check fails.
   */
  verify(
    rawBody: string,
    headers: Record<string, string>,
    secret: string,
  ): unknown | null;
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
