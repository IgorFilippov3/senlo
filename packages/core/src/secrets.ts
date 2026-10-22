// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Secrets at rest: provider credentials (API keys, SMTP passwords) are stored
 * sealed, so a database dump or a `psql` session does not hand them out.
 *
 * `SecretCipher` is the port. The default seals with AES-GCM on a key from
 * the config (`aesGcmCipher`); a managed host can plug in a KMS-backed one.
 * The stored shape is a one-key JSON envelope `{ $sealed: "<token>" }`, so
 * the column stays `jsonb` and a row written before sealing (a plain config
 * object) is told apart by shape and still opens.
 */

import { openJson, sealJson } from "./signing";

export interface SecretCipher {
  /** Seals any JSON value into an opaque string. */
  seal(value: unknown): Promise<string>;
  /** The sealed value, or null when the token was altered or sealed with another key. */
  open(token: string): Promise<unknown>;
}

/** AES-GCM over Web Crypto, keyed from `secret` (`SECRETS_KEY` in the config). */
export function aesGcmCipher(secret: string): SecretCipher {
  if (!secret) throw new Error("aesGcmCipher needs a non-empty secret");
  return {
    seal: (value) => sealJson(value, secret),
    open: (token) => openJson(token, secret),
  };
}

export const SEALED_KEY = "$sealed";

export interface SealedEnvelope {
  [SEALED_KEY]: string;
}

export function isSealedEnvelope(value: unknown): value is SealedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)[SEALED_KEY] === "string"
  );
}

export async function sealConfig(
  cipher: SecretCipher,
  config: Record<string, unknown>,
): Promise<SealedEnvelope> {
  return { [SEALED_KEY]: await cipher.seal(config) };
}

/** Thrown when a sealed config cannot be opened: the key changed, or the row was altered. */
export class SealedConfigError extends Error {
  /** `what` names the row, such as "Email provider 12", for the log. */
  constructor(what?: string) {
    super(
      `${what ? `${what}: its` : "A"} stored config cannot be decrypted. SECRETS_KEY (or the secret it falls back to) is not the one it was sealed with; re-enter the credentials, or run db:reseal-secrets with OLD_SECRETS_KEY.`,
    );
    this.name = "SealedConfigError";
  }
}

/**
 * The plain config behind what the database holds: opens a sealed envelope,
 * passes a legacy plain object through (rows from before sealing; `db:reseal-secrets`
 * rewrites them), and refuses anything else.
 */
export async function openConfig(
  cipher: SecretCipher,
  stored: unknown,
): Promise<Record<string, unknown>> {
  if (isSealedEnvelope(stored)) {
    const plain = await cipher.open(stored[SEALED_KEY]);
    if (typeof plain !== "object" || plain === null || Array.isArray(plain)) {
      throw new SealedConfigError();
    }
    return plain as Record<string, unknown>;
  }
  if (typeof stored === "object" && stored !== null && !Array.isArray(stored)) {
    return stored as Record<string, unknown>;
  }
  throw new SealedConfigError();
}

/**
 * Like {@link openConfig}, for reading rows into entities: a row that cannot
 * be opened comes back as an empty config with `unreadable` set instead of
 * failing, so one row sealed with another key does not take a whole list down.
 */
export async function openConfigOrFlag(
  cipher: SecretCipher,
  stored: unknown,
): Promise<{ config: Record<string, unknown>; unreadable: boolean }> {
  try {
    return { config: await openConfig(cipher, stored), unreadable: false };
  } catch (error) {
    if (error instanceof SealedConfigError) return { config: {}, unreadable: true };
    throw error;
  }
}
