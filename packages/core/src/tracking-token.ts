// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { constantTimeEqual, openJson, sealJson, signPayload } from "./signing";

/**
 * Who a tracked message went to. Sealed rather than signed: the address must
 * not be readable in the link (issue #2), and nobody may edit it to record
 * opens and clicks against another campaign.
 */
export interface TrackingTokenData {
  campaignId: number;
  email: string;
}

export async function sealTrackingToken(
  data: TrackingTokenData,
  secret: string,
): Promise<string> {
  return sealJson({ c: data.campaignId, e: data.email }, secret);
}

export async function openTrackingToken(
  token: string,
  secret: string,
): Promise<TrackingTokenData | null> {
  const value = (await openJson(token, secret)) as { c?: unknown; e?: unknown } | null;
  if (!value || typeof value.c !== "number" || typeof value.e !== "string") {
    return null;
  }
  return { campaignId: value.c, email: value.e };
}

/**
 * Binds a click destination to the recipient token. Without it the `url`
 * parameter could be swapped for any address and the link would redirect
 * there - an open redirect on the sender's own domain.
 *
 * 128 bits of the HMAC: plenty against guessing, and every tracked link in
 * the message is shorter for it.
 */
export async function clickSignature(
  token: string,
  url: string,
  secret: string,
): Promise<string> {
  return (await signPayload(`click\n${token}\n${url}`, secret)).slice(0, 22);
}

export async function verifyClickSignature(
  token: string,
  url: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return constantTimeEqual(await clickSignature(token, url, secret), signature);
}

/** Where the open pixel and the click redirect live for one recipient. */
export function trackingUrls(baseUrl: string, token: string) {
  return {
    open: `${baseUrl}/api/t/o/${token}`,
    click: `${baseUrl}/api/t/c/${token}`,
  };
}
