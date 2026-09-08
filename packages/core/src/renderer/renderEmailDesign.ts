// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "../emailDesign";
import { RenderContext, RenderOptions, resolveGlobals } from "./types";
import { renderHead } from "./renderHead";
import { renderBody } from "./renderBody";
import { replaceMergeTags } from "../merge-tags";
import { escapeAttr, escapeHtml, sanitizeUrlsInHtml } from "./escape";
import { renderPreheader } from "./renderPreheader";
import { migrateEmailDesign } from "../migrations";

export function renderEmailDesign(
  rawDesign: EmailDesignDocument,
  options?: RenderOptions
): string {
  // A document saved by an older editor is reshaped here rather than in every
  // caller: this and the MJML export are the two ways a stored document becomes
  // an email, so a message can never be built from a shape the blocks no longer
  // understand.
  const design = migrateEmailDesign(rawDesign);

  const context: RenderContext = {
    responsiveStyles: [],
    options,
    // Resolved once so every block can write the font and colour inline.
    globals: resolveGlobals(design.settings),
  };

  const headContent = renderHead(design, context);
  const bodyContent = renderBody(design.rows, design, context);

  let html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title>${escapeHtml(options?.title || "")}</title>
  ${headContent}
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:${escapeAttr(design.settings.backgroundColor || "#ffffff")};">
  <div role="article" aria-roledescription="email" lang="en" style="-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:${escapeAttr(design.settings.backgroundColor || "#ffffff")};">
    ${renderPreheader(options?.preheader)}
    ${bodyContent}
  </div>
</body>
</html>
  `.trim();

  if (options?.data) {
    html = replaceMergeTags(html, options.data);
  }

  // Last line of defence: a merge tag can put anything into an href or an src,
  // and the substitution above happens after the document is assembled, so the
  // scheme check has to run over the finished HTML.
  return sanitizeUrlsInHtml(html);
}










