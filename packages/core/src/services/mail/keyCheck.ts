// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { KeyCheck } from "../../ports";

export const KEY_VALID: KeyCheck = { status: "valid" };
export const keyInvalid = (message: string): KeyCheck => ({ status: "invalid", message });
export const keyLimited = (message: string): KeyCheck => ({ status: "limited", message });
export const keyUnknown = (message: string): KeyCheck => ({ status: "unknown", message });

/** How long a key check may take before it counts as "could not check". */
export const KEY_CHECK_TIMEOUT_MS = 10_000;

/**
 * A provider's answer that a retry cannot change: a 4xx other than a
 * timeout (408) or a rate limit (429). A bad key, an unverified sender
 * domain, a refused payload all stay refused.
 */
export function isPermanentHttpStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/**
 * One cheap authenticated GET. `classify` reads the answer; a network error,
 * a timeout or an answer it leaves to the default (5xx, anything odd) is
 * "unknown": the key may be fine, it just could not be checked.
 */
export async function checkKeyOverHttp(
  provider: string,
  url: string,
  headers: Record<string, string>,
  classify: (status: number, body: any) => KeyCheck | null,
): Promise<KeyCheck> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      // Resend refuses requests without one (403 before the key is read).
      headers: { "User-Agent": "Senlo", Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
    });
  } catch (e: any) {
    return keyUnknown(`Could not reach ${provider}: ${e?.message || "network error"}`);
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // An empty or non-JSON body: the status still says enough.
  }
  return classify(res.status, body) ?? keyUnknown(`${provider} answered with status ${res.status}`);
}

/** The usual reading: 2xx valid, 401/403 the key is refused, anything else unknown. */
export function authStatus(provider: string, status: number, message?: string): KeyCheck | null {
  if (status >= 200 && status < 300) return KEY_VALID;
  if (status === 401 || status === 403) {
    return keyInvalid(`${provider} rejected the credentials${message ? `: ${message}` : ""}`);
  }
  return null;
}
