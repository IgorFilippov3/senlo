// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "../emailDesign";
import type { RenderOptions } from "./types";
import { replaceMergeTags } from "../merge-tags";
import { sanitizeUrlsInHtml } from "./escape";
import { wrapLinksWithTracking } from "../tracking";
import { injectBeforeBodyEnd } from "./htmlToText";

export interface PersonalizeOptions {
  /** Merge tag values for this recipient. */
  data?: RenderOptions["data"];
  /** Base URL for click tracking; links are left alone when absent. */
  clickTrackingBaseUrl?: string;
  /** Links that must keep their destination, such as the unsubscribe page. */
  skipTrackingUrls?: string[];
  /** Open tracking pixel, injected inside the body. */
  trackingPixelUrl?: string;
}

/**
 * Turns a rendered template into the message one recipient receives.
 *
 * Everything here is per-recipient and cheap: substitution, the URL scheme
 * check that has to follow it, click tracking and the open pixel. The document
 * itself is rendered once, by {@link renderEmailTemplate}.
 *
 * The order is not arbitrary. A merge tag can resolve to a URL, so the scheme
 * check has to run after substitution, and click tracking has to see the final
 * destination rather than a `{{...}}` placeholder.
 */
export function personalizeEmail(
  templateHtml: string,
  options: PersonalizeOptions = {},
): string {
  let html = templateHtml;

  if (options.data) {
    html = replaceMergeTags(html, options.data);
    html = sanitizeUrlsInHtml(html);
  }

  if (options.clickTrackingBaseUrl) {
    html = wrapLinksWithTracking(html, options.clickTrackingBaseUrl, {
      skipUrls: options.skipTrackingUrls,
    });
  }

  if (options.trackingPixelUrl) {
    html = injectBeforeBodyEnd(
      html,
      `<img src="${options.trackingPixelUrl}" width="1" height="1" style="display:none !important;" alt="" />`,
    );
  }

  return html;
}

/**
 * True when the document renders the same way for every recipient.
 *
 * A condition is evaluated against the recipient's data and a loop repeats a
 * row from it, so a document that uses either has to be rendered per recipient.
 * Everything else can be rendered once for the whole campaign and only have its
 * merge tags substituted per message.
 */
export function isRecipientIndependent(design: EmailDesignDocument): boolean {
  return design.rows.every(
    (row) =>
      !row.condition &&
      !row.loop &&
      row.columns.every((column) =>
        column.blocks.every((block) => !block.condition),
      ),
  );
}
