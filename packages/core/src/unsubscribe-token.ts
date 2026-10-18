// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { decodeJson, openJson, sealJson, verifyPayload } from "./signing";

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

/**
 * Sealed with AES-GCM, so the token is unforgeable and the recipient's
 * address cannot be read out of the link. base64url, safe in a path segment.
 */
export async function encodeUnsubscribeToken(
  data: UnsubscribeTokenData,
  secret: string,
): Promise<string> {
  return sealJson(data, secret);
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
 * Reads the three formats mail in the wild carries:
 *
 * - sealed (current): trusted, `signed: true`;
 * - `<payload>.<signature>` (signed, not sealed - mail sent between the two
 *   changes): trusted when the signature matches, refused when it does not;
 * - plain base64url JSON (before tokens were signed): `signed: false`.
 *
 * A sealed token and a plain one both lack a dot; a plain one never opens as
 * AES-GCM, so trying to open it first is unambiguous.
 */
export async function decodeUnsubscribeToken(
  token: string,
  secret: string,
): Promise<DecodedUnsubscribeToken | null> {
  if (!token) return null;

  const dot = token.indexOf(".");
  if (dot !== -1) {
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    if (!payload || !signature || signature.includes(".")) return null;
    if (!(await verifyPayload(payload, signature, secret))) return null;

    const data = readData(decodeJson(payload));
    return data ? { data, signed: true } : null;
  }

  const sealed = readData(await openJson(token, secret));
  if (sealed) return { data: sealed, signed: true };

  const legacy = readData(decodeJson(token));
  return legacy ? { data: legacy, signed: false } : null;
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
