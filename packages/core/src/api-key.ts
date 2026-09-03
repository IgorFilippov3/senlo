// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { randomBytes } from "node:crypto";

const API_KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * 32 characters drawn from the OS random source — 160 bits of entropy.
 *
 * This value is the only thing standing in front of the public send endpoints,
 * so it must not come from `Math.random()`, whose output is predictable from
 * previous draws. The alphabet is lowercase base32 (RFC 4648) precisely
 * because it has 32 symbols: 256 divides evenly by 32, so taking a byte modulo
 * the alphabet length introduces no bias.
 *
 * Keys issued before this existed keep working; only new ones use this shape.
 */
export function generateApiKey(): string {
  const bytes = randomBytes(32);
  let value = "";

  for (let i = 0; i < bytes.length; i++) {
    value += API_KEY_ALPHABET.charAt(bytes[i] % API_KEY_ALPHABET.length);
  }

  return `snl_${value}`;
}
