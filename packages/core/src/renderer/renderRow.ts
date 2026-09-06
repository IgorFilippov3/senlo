import { RowBlock, ColumnBlock } from "../emailDesign";
import { RenderContext } from "./types";
import { renderBlock } from "./renderBlocks";
import { evaluateCondition } from "./conditions";
import { escapeAttr } from "./escape";

export function renderRow(row: RowBlock, context: RenderContext): string {
  if (!evaluateCondition(row.condition, context)) {
    return "";
  }

  const { settings } = row;
  const padding = settings.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const borderRadius = settings.borderRadius || { top: 0, bottom: 0 };

  const rowStyle = [
    `background-color: ${settings.backgroundColor || "transparent"}`,
    `padding: ${padding.top || 0}px ${padding.right || 0}px ${
      padding.bottom || 0
    }px ${padding.left || 0}px`,
    `border-top-left-radius: ${borderRadius.top || 0}px`,
    `border-top-right-radius: ${borderRadius.top || 0}px`,
    `border-bottom-left-radius: ${borderRadius.bottom || 0}px`,
    `border-bottom-right-radius: ${borderRadius.bottom || 0}px`,
  ]
    .map(escapeAttr)
    .join("; ");

  return `
    <!--[if mso]>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="${rowStyle}">
    <![endif]-->
    <div style="${rowStyle}; font-size: 0; text-align: ${escapeAttr(
      settings.align || "center",
    )};">
      <!--[if mso]>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
      <![endif]-->
      ${row.columns.map((col) => renderColumn(col, context)).join("")}
      <!--[if mso]>
        </tr>
      </table>
      <![endif]-->
    </div>
    <!--[if mso]>
        </td>
      </tr>
    </table>
    <![endif]-->
  `;
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
