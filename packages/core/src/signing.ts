// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * HMAC signing for links that act without a login - unsubscribe today,
 * tracking next. A link that carries ids must be signed, or anyone can edit
 * the ids and act on another recipient or another project.
 *
 * Built on Web Crypto (`globalThis.crypto.subtle`) rather than `node:crypto`:
 * core is also imported by client components, and a Node-only module in that
 * graph can break the browser build. The price is that signing is async.
 */

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

/**
 * The secret links are signed with. `LINK_SIGNING_SECRET` lets it rotate
 * independently; without it `AUTH_SECRET` is used, which every install
 * already has. Rotating either invalidates links in mail already sent.
 */
export function resolveSigningSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.LINK_SIGNING_SECRET || env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "LINK_SIGNING_SECRET or AUTH_SECRET must be set to sign unsubscribe and tracking links",
    );
  }
  return secret;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeJson(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

export function decodeJson(value: string): unknown {
  const bytes = fromBase64Url(value);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    keyCache.set(secret, key);
  }
  return key;
}

export async function signPayload(payload: string, secret: string): Promise<string> {
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** Compares in time that does not depend on where the strings differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function verifyPayload(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return constantTimeEqual(await signPayload(payload, secret), signature);
}

const sealKeyCache = new Map<string, Promise<CryptoKey>>();

/**
 * An AES-GCM key of its own, derived from the secret with a label, so the
 * sealing key and the HMAC key are never the same bytes.
 */
function sealKey(secret: string): Promise<CryptoKey> {
  let key = sealKeyCache.get(secret);
  if (!key) {
    key = globalThis.crypto.subtle
      .digest("SHA-256", encoder.encode(`senlo:seal:${secret}`))
      .then((raw) =>
        globalThis.crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
          "encrypt",
          "decrypt",
        ]),
      );
    sealKeyCache.set(secret, key);
  }
  return key;
}

/**
 * Encrypts and authenticates a value into one base64url string. Use it where
 * the contents must not be readable in the URL - a recipient's address - as
 * well as unforgeable.
 */
export async function sealJson(value: unknown, secret: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await sealKey(secret),
    encoder.encode(JSON.stringify(value)),
  );
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(out);
}

/** The sealed value, or null when it was altered, truncated or sealed with another secret. */
export async function openJson(token: string, secret: string): Promise<unknown> {
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length < 12 + 16 + 1) return null;
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      await sealKey(secret),
      bytes.slice(12),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}
