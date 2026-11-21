// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Why `text` is not a JSON object, or `null` when it is one or is blank
 * (a blank field means "no value"). Shared by forms, which show the message
 * under the field, and by server schemas, which reject the same input.
 */
export function jsonObjectError(text: string): string | null {
  if (text.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "Invalid JSON. Check quotes around keys and strings, and trailing commas.";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return 'Must be a JSON object, e.g. {"name": "Ann"}.';
  }
  return null;
}
