import type { RowBlock, ColumnBlock } from "../emailDesign";
import { RenderContext, globalsOf } from "./types";
import { renderBlock } from "./renderBlocks";
import { evaluateCondition } from "./conditions";
import { escapeAttr } from "./escape";
import { cell, hasMargin, renderPadding } from "./utils";
import {
  registerRowBackground,
  rowBackground,
  rowBackgroundDeclarations,
  rowBorderDeclarations,
} from "./rowBackground";

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

  // A side gap has to come out of the row's own width, not only off the cell
  // around it.
  //
  // The cell below carries the gap as padding, and that is all it used to be.
  // But the cell is as wide as the message, while the row inside it is a table
  // of a fixed number of pixels: at any desktop width there is room to spare on
  // both sides, so the padding ate empty space and the row never moved. It only
  // did anything once the viewport fell below the row's own width - which is to
  // say, on a phone and nowhere else.
  //
  // This is the half of the gap that went missing when rows stopped living
  // inside one document-wide table and started carrying a width each: until
  // then the cell was 600px too, so the padding had something to take from.
  //
  // A full-width row is left alone: its band is `width="100%"`, so the cell's
  // padding already narrows it, and taking the gap off the content as well
  // would inset it twice.
  const sideGap = fullWidth
    ? 0
    : (Number(settings.margin?.left) || 0) + (Number(settings.margin?.right) || 0);

  // A gap wider than the row itself is not a layout; clamping keeps the width
  // attribute a legal number and leaves the author looking at something plainly
  // wrong rather than at nothing at all.
  const renderedWidth = Math.max(width - sideGap, 1);

  // What paints behind the row - the colour, and the gradient over it when the
  // row has one - is decided in `rowBackground`, which the canvas calls too.
  // The declarations come back colour first: a client that drops the image has
  // to keep the colour, and roughly two in five drop the image.
  const background = rowBackground(settings);

  // The rule goes on the same element as the background, which for a
  // full-width row is the band rather than the row. Turning that toggle on says
  // the band is the visual object - a hairline above a footer band that stopped
  // at the content width would read as a mistake - and tying the two together
  // is one decision instead of two that can disagree.
  //
  // It lands on the cell that carries the padding too, so the padding pushes
  // the content away from the rule and the rule marks the row's edge rather
  // than the text's. The outer gap is a cell further out, so a row with both
  // gets its rule inside its gap, which is what "outside the background" has
  // always meant here.
  const backgroundStyle = [
    ...rowBackgroundDeclarations(settings),
    ...rowBorderDeclarations(settings),
    `border-top-left-radius: ${borderRadius.top || 0}px`,
    `border-top-right-radius: ${borderRadius.top || 0}px`,
    `border-bottom-left-radius: ${borderRadius.bottom || 0}px`,
    `border-bottom-right-radius: ${borderRadius.bottom || 0}px`,
  ]
    .map(escapeAttr)
    .join("; ");

  // Gmail on Android reads a gradient only from the stylesheet, so a row that
  // has one also gets a class. It goes on whichever element the background
  // went on, which for a full-width row is the band rather than the row.
  const backgroundClass = background.backgroundImage
    ? ` class="${registerRowBackground(context, background.backgroundImage)}"`
    : "";

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
    <table class="senlo-full-width" role="presentation" width="${renderedWidth}" border="0" cellpadding="0" cellspacing="0" align="center" style="width: ${renderedWidth}px; max-width: 100%; margin: 0 auto; border-collapse: collapse;">
      <tr>
        <td align="${align}"${fullWidth ? "" : backgroundClass} style="${rowStyle}; font-size: 0; text-align: ${align};">
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
        <td align="center"${backgroundClass} style="${backgroundStyle}; font-size: 0;">
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
