// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { decodeJson, encodeJson, signPayload, verifyPayload } from "./signing";

export interface UnsubscribeTokenData {
  /**
   * Present for campaign sends, where the recipient is a known contact.
   * Triggered sends can go to an address that has no contact row, so the
   * token carries the project and the address instead.
   */
  contactId?: number;
  projectId?: number;
  email?: string;
  campaignId: number;
}

export interface DecodedUnsubscribeToken {
  data: UnsubscribeTokenData;
  /**
   * False for a token issued before tokens were signed. Its ids may have been
   * edited by anyone, so it must not unsubscribe on its own: the recipient
   * has to confirm their address first.
   */
  signed: boolean;
}

/** `<payload>.<signature>`, both base64url, so the token fits a path segment. */
export async function encodeUnsubscribeToken(
  data: UnsubscribeTokenData,
  secret: string,
): Promise<string> {
  const payload = encodeJson(data);
  return `${payload}.${await signPayload(payload, secret)}`;
}

function readData(value: unknown): UnsubscribeTokenData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as UnsubscribeTokenData;
  if (typeof data.campaignId !== "number") return null;
  // Tokens issued before triggered sends had an unsubscribe link carry only
  // a contact id, so either identifier is enough.
  if (data.contactId === undefined && !data.email) return null;
  return data;
}

/**
 * A signed token whose signature does not match is refused outright. A token
 * without a signature is a legacy one and comes back with `signed: false`.
 */
export async function decodeUnsubscribeToken(
  token: string,
  secret: string,
): Promise<DecodedUnsubscribeToken | null> {
  if (!token) return null;

  const dot = token.indexOf(".");
  if (dot === -1) {
    const data = readData(decodeJson(token));
    return data ? { data, signed: false } : null;
  }

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature || signature.includes(".")) return null;
  if (!(await verifyPayload(payload, signature, secret))) return null;

  const data = readData(decodeJson(payload));
  return data ? { data, signed: true } : null;
}

/**
 * Headers Gmail and Yahoo require from bulk senders: a one-click unsubscribe
 * that never asks the recipient to log in or confirm. The URL must accept a
 * POST, which is why it points at the API route rather than the page.
 */
export function buildUnsubscribeHeaders(
  oneClickUrl?: string,
): Record<string, string> | undefined {
  if (!oneClickUrl) return undefined;

  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** The page a recipient lands on, and the endpoint one-click posts to. */
export function unsubscribeUrls(baseUrl: string, token: string) {
  return {
    page: `${baseUrl}/unsubscribe/${token}`,
    oneClick: `${baseUrl}/api/unsubscribe/${token}`,
  };
}
