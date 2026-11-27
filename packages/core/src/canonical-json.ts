// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A value with object keys sorted, so key order does not count as a change.
 * Postgres `jsonb` reorders keys, so a document read back never has the
 * order it was written in.
 */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Equal values, object keys in any order; null and undefined count as `{}`. */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a ?? {})) === JSON.stringify(canonical(b ?? {}));
}
