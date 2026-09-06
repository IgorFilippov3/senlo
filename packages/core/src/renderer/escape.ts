// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * HTML escaping and URL sanitization helpers for the email renderer.
 *
 * Two different escape functions on purpose:
 *
 * - `escapeAttr` is for values that come from the template author (alt text,
 *   static hrefs, colors). It leaves `{` alone so a merge tag written inside an
 *   attribute -- alt="{{contact.first_name}}" -- still resolves later.
 *
 * - `escapeMergeValue` is for values that come from recipient data. It also
 *   escapes `{`, so a value that itself contains a merge tag can never be
 *   expanded by a later substitution pass. Loop rows are substituted per
 *   iteration and the whole document is substituted once more afterwards.
 */

/**
 * Author-controlled values. Note that `;` is NOT escaped: whole `style`
 * attributes go through this function and need their declaration separators.
 */
const ATTR_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const ATTR_CHARS = /[&<>"']/g;

/**
 * Recipient data. Adds `{`, so a value cannot be re-read as a merge tag, and
 * `;`, so a value substituted into a `style` attribute cannot append its own
 * CSS declarations. A single pass over the string, so the entities produced
 * here are never escaped again.
 */
const MERGE_MAP: Record<string, string> = {
  ...ATTR_MAP,
  "{": "&#123;",
  ";": "&#59;",
};
const MERGE_CHARS = /[&<>"'{;]/g;

/**
 * Escape a value that comes from the template itself, for use in element
 * content or in a quoted attribute. Merge tag braces are preserved.
 */
export function escapeAttr(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(ATTR_CHARS, (c) => ATTR_MAP[c]);
}

/** Alias of escapeAttr, for readability at element-content call sites. */
export const escapeHtml = escapeAttr;

/**
 * Escape a resolved merge tag value. Also escapes `{`, so the value cannot be
 * re-interpreted as a merge tag by a subsequent substitution pass.
 */
export function escapeMergeValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(MERGE_CHARS, (c) => MERGE_MAP[c]);
}

/**
 * Strip characters that would let a value break out of a <style> block or out
 * of a CSS declaration. Quotes are kept -- font family names need them.
 */
export function escapeCssValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/[<>{};\\@()\/*]/g, "");
}

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * Decode the entities this renderer produces, plus arbitrary numeric entities.
 * Used before inspecting a URL, so an entity-encoded scheme is caught, and
 * before re-encoding a URL for click tracking.
 */
export function decodeHtmlEntities(value: string): string {
  return String(value)
    .replace(
      /&(?:amp|lt|gt|quot|#39);/gi,
      (m) => NAMED_ENTITIES[m.toLowerCase()] ?? m,
    )
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

/** Schemes that must never end up in an href or an src. */
const DANGEROUS_SCHEME =
  /^(?:javascript|vbscript|livescript|mocha|data|file|blob):/;

/**
 * True when the URL resolves to a scheme that can execute code or read local
 * files. Entities are decoded and whitespace/control characters removed first,
 * because both entity-encoded and tab-separated schemes are live vectors in
 * some clients.
 *
 * @param allowDataImage - permit data:image/..., which is legitimate for an
 *   img src even though many mail clients block it.
 */
export function isDangerousUrl(url: string, allowDataImage = false): boolean {
  const normalized = decodeHtmlEntities(String(url))
    .replace(/[\x00-\x20]/g, "")
    .toLowerCase();

  if (allowDataImage && normalized.startsWith("data:image/")) return false;

  return DANGEROUS_SCHEME.test(normalized);
}

/**
 * Sanitize a URL taken from the design document. Returns a fallback when the
 * scheme is dangerous. Merge tags pass through untouched -- the value they
 * resolve to is checked later by sanitizeUrlsInHtml.
 */
export function sanitizeUrl(
  url: unknown,
  options?: { allowDataImage?: boolean; fallback?: string },
): string {
  const fallback = options?.fallback ?? "";
  if (url === undefined || url === null) return fallback;

  const value = String(url);
  if (!value) return fallback;

  return isDangerousUrl(value, options?.allowDataImage) ? fallback : value;
}

const HREF_OR_SRC = /\s(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/**
 * Final safety net over the assembled document: neutralize any href or src
 * carrying a dangerous scheme. This catches values that arrived through a merge
 * tag, which cannot be checked where the attribute is written because
 * substitution happens after the document is assembled.
 */
export function sanitizeUrlsInHtml(html: string): string {
  return html.replace(
    HREF_OR_SRC,
    (match, attr: string, doubleQuoted?: string, singleQuoted?: string) => {
      const quote = doubleQuoted !== undefined ? '"' : "'";
      const value =
        doubleQuoted !== undefined ? doubleQuoted : (singleQuoted ?? "");
      const isSrc = attr.toLowerCase() === "src";

      if (!isDangerousUrl(value, isSrc)) return match;

      return ` ${attr}=${quote}${isSrc ? "" : "#"}${quote}`;
    },
  );
}
