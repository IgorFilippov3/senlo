// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { decodeHtmlEntities } from "./escape";

/** Elements whose content never belongs in the plain text alternative. */
const DROPPED_ELEMENTS = /<(script|style|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * The hidden preheader block. It exists for the inbox listing, and its
 * zero-width spacer would otherwise open the text version with a wall of
 * invisible characters.
 */
const PREHEADER_BLOCK =
  /<div[^>]*data-senlo-preheader[^>]*>[\s\S]*?<\/div>/gi;

/**
 * HTML comments, which in an email are mostly Outlook conditionals. Dropping
 * them removes the VML copy of every button, so a label does not appear twice
 * in the text version. The `<!--[if !mso]><!-->` form ends at its own `-->`,
 * so the content it guards survives.
 */
const COMMENTS = /<!--[\s\S]*?-->/g;

/** Elements that end a line of text. */
const BLOCK_ELEMENTS =
  /<\/?(?:p|div|tr|table|h[1-6]|ul|ol|blockquote|section|header|footer)\b[^>]*>/gi;

/**
 * Strip tags from a fragment, leaving the visible words. Used where a label has
 * to be text, such as inside the VML fallback of a button.
 */
export function stripTags(html: string): string {
  return decodeHtmlEntities(
    String(html ?? "")
      .replace(DROPPED_ELEMENTS, "")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the text/plain alternative of a rendered email.
 *
 * This is deliberately a small converter rather than a dependency: the input is
 * always our own renderer's output, not arbitrary web HTML. Links keep their
 * destination in parentheses so a text-only reader can still act on them, and
 * the tracking pixel disappears with every other image.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";

  let text = String(html)
    .replace(DROPPED_ELEMENTS, "")
    .replace(PREHEADER_BLOCK, "")
    .replace(COMMENTS, "");

  // Keep the destination of a link next to its label.
  text = text.replace(
    /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, _quote, href: string, label: string) => {
      const text_ = stripTags(label);
      const url = decodeHtmlEntities(href).trim();

      if (!url || url.startsWith("#")) return text_;
      if (!text_) return url;
      if (text_ === url) return url;
      return `${text_} (${url})`;
    },
  );

  // An image contributes its alt text, if it has any. The tracking pixel has
  // alt="" by design and so contributes nothing.
  text = text.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = /alt\s*=\s*(["'])(.*?)\1/i.exec(tag);
    return alt && alt[2] ? `[${decodeHtmlEntities(alt[2])}]` : "";
  });

  text = text
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(BLOCK_ELEMENTS, "\n")
    .replace(/<[^>]*>/g, "");

  return decodeHtmlEntities(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    // Collapse runs of blank lines into one.
    .filter((line, i, lines) => line !== "" || (i > 0 && lines[i - 1] !== ""))
    .join("\n")
    .trim();
}

/**
 * Insert a snippet immediately before the closing body tag. Appending after
 * </html> instead produces an invalid document, and some clients and
 * sanitizers drop the trailing content - which, for the open tracking pixel,
 * means losing the open.
 */
export function injectBeforeBodyEnd(html: string, snippet: string): string {
  if (!snippet) return html;

  const index = html.toLowerCase().lastIndexOf("</body>");
  if (index === -1) return html + snippet;

  return html.slice(0, index) + snippet + html.slice(index);
}

/** Gmail clips a message past this size, hiding everything after the cut. */
export const EMAIL_CLIPPING_BYTES = 102400;
