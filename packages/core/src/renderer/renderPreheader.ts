// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { escapeHtml } from "./escape";

/**
 * Zero-width characters that push the message body out of the inbox preview.
 * Without them a client keeps pulling text from the first block until it has
 * filled its preview line, so the preheader would be followed by "View in
 * browser" or whatever the first row happens to say.
 */
const PREVIEW_SPACER = "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;".repeat(15);

const HIDDEN_STYLE = [
  "display: none",
  "font-size: 1px",
  "line-height: 1px",
  "max-height: 0px",
  "max-width: 0px",
  "opacity: 0",
  "overflow: hidden",
  "mso-hide: all",
].join("; ");

/**
 * The hidden preview text an inbox shows next to the subject line. Returns an
 * empty string when there is no preheader, so the message is unchanged.
 */
export function renderPreheader(preheader?: string): string {
  if (!preheader || !preheader.trim()) return "";

  // The marker lets the plain text converter drop this block: preview text
  // belongs to the inbox listing, not to the message body, and the spacer
  // characters would be noise in a text-only reader.
  return `<div data-senlo-preheader="true" style="${HIDDEN_STYLE}">${escapeHtml(preheader.trim())}${PREVIEW_SPACER}</div>`;
}
