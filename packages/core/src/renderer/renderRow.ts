import type { RowBlock, ColumnBlock } from "../emailDesign";
import { RenderContext, globalsOf } from "./types";
import { renderBlock } from "./renderBlocks";
import { evaluateCondition } from "./conditions";
import { escapeAttr } from "./escape";
import { cell, hasMargin, renderPadding } from "./utils";

export function renderRow(row: RowBlock, context: RenderContext): string {
  if (!evaluateCondition(row.condition, context)) {
    return "";
  }

  const { settings } = row;
  const padding = settings.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const borderRadius = settings.borderRadius || { top: 0, bottom: 0 };
  const align = escapeAttr(settings.align || "center");

  // The document's width is the row's default and its ceiling. A row saved in a
  // 700px template and dropped into a 500px one narrows rather than overflowing
  // the body, because a table wider than its parent is the one thing every
  // client renders differently.
  const contentWidth = globalsOf(context).contentWidth;
  const width = Math.min(Number(settings.width) || contentWidth, contentWidth);

  // A full-width row paints its background across the whole viewport while its
  // content stays at `width` - the band behind a header or a footer. Everything
  // the background touches therefore moves to the band, and the row's own cell
  // is left with the padding, which is the space around the content and not
  // around the band.
  const fullWidth = Boolean(settings.fullWidth);

  const backgroundStyle = [
    `background-color: ${settings.backgroundColor || "transparent"}`,
    `border-top-left-radius: ${borderRadius.top || 0}px`,
    `border-top-right-radius: ${borderRadius.top || 0}px`,
    `border-bottom-left-radius: ${borderRadius.bottom || 0}px`,
    `border-bottom-right-radius: ${borderRadius.bottom || 0}px`,
  ]
    .map(escapeAttr)
    .join("; ");

  const paddingStyle = escapeAttr(`padding: ${renderPadding(padding)}`);

  const rowStyle = fullWidth
    ? paddingStyle
    : `${backgroundStyle}; ${paddingStyle}`;

  // The row lives in a real table rather than an Outlook-only one. The previous
  // shape put the same style on a conditional <td> AND on the inner <div>,
  // which meant Outlook applied the padding twice. A <td> is the one element
  // every client, Outlook included, pads correctly, so the style belongs there
  // and nowhere else. The conditional table below is only for the columns:
  // Outlook does not lay out inline-block divs side by side.
  //
  // `senlo-full-width` is what the media query in the head widens to 100% on a
  // phone, so a row narrower than the document still fills a small screen.
  let html = `
    <table class="senlo-full-width" role="presentation" width="${width}" border="0" cellpadding="0" cellspacing="0" align="center" style="width: ${width}px; max-width: 100%; margin: 0 auto; border-collapse: collapse;">
      <tr>
        <td align="${align}" style="${rowStyle}; font-size: 0; text-align: ${align};">
          <!--[if mso]>
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
          <![endif]-->
          ${row.columns.map((col) => renderColumn(col, context)).join("")}
          <!--[if mso]>
            </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  `;

  if (fullWidth) {
    html = `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tr>
        <td align="center" style="${backgroundStyle}; font-size: 0;">
          ${html}
        </td>
      </tr>
    </table>
  `;
  }

  // The gap outside the background needs a cell of its own: the row's own cell
  // already paints the background, and one cell cannot both paint a background
  // and keep it out of the space next to it. This is the same shape `renderBox`
  // gives a block's margin, one level up.
  //
  // A row whose author set no margin comes back untouched.
  if (!hasMargin(settings.margin)) return html;

  return cell(`padding: ${renderPadding(settings.margin)}`, html);
}

function renderColumn(column: ColumnBlock, context: RenderContext): string {
  // Width reaches both an attribute and two style declarations, so it is
  // coerced rather than escaped.
  const width = Number(column.width) || 100;
  const widthAttr = width === 100 ? "" : `width="${width}%"`;

  return `
    <!--[if mso]>
    <td ${widthAttr} valign="top" style="width: ${width}%;">
    <![endif]-->
    <div class="senlo-stack" style="display: inline-block; width: 100%; max-width: ${width}%; vertical-align: top; font-size: 16px;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="left">
            ${column.blocks
              .map((block) => renderBlock(block, context))
              .join("")}
          </td>
        </tr>
      </table>
    </div>
    <!--[if mso]>
    </td>
    <![endif]-->
  `;
}
