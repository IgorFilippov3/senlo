import type { EmailDesignDocument, RowBlock } from "../emailDesign";
import { RenderContext, MAX_LOOP_ITERATIONS } from "./types";
import { renderRow } from "./renderRow";
import { replaceMergeTags } from "../merge-tags";
import { resolveVariable } from "./conditions";
import { escapeAttr } from "./escape";

export function renderBody(
  rows: RowBlock[],
  design: EmailDesignDocument,
  context: RenderContext,
): string {
  // Numeric coercion, not escaping: this value also lands inside a media
  // query in the head, where entities would not be decoded.
  const contentWidth = Number(design.settings.contentWidth) || 600;

  const renderedRows = rows.map((row) => {
    if (row.loop) {
      const data = context.options?.data || {};
      const loopData = resolveVariable(row.loop.variable, data);

      if (Array.isArray(loopData)) {
        // Loop data can arrive through the public trigger API, where an
        // unbounded array would render an unbounded email.
        const limit = context.options?.maxLoopIterations ?? MAX_LOOP_ITERATIONS;
        const items =
          loopData.length > limit ? loopData.slice(0, limit) : loopData;

        if (loopData.length > limit) {
          console.warn(
            `[renderer] Loop on "${row.loop.variable}" truncated: ${loopData.length} items, limit ${limit}`,
          );
        }

        return items
          .map((item) => {
            const localContext = {
              ...context,
              localData: {
                ...context.localData,
                [row.loop!.alias]: item,
              },
            };
            let rowHtml = renderRow(row, localContext);
            // Replace local tags immediately for this iteration
            if (localContext.localData && localContext.options?.data) {
              rowHtml = replaceMergeTags(
                rowHtml,
                localContext.options.data,
                localContext.localData,
              );
            }
            return rowHtml;
          })
          .join("");
      }
      return ""; // If loop data is not an array, don't render
    }

    return renderRow(row, context);
  });

  return `
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${escapeAttr(design.settings.backgroundColor || "#ffffff")};">
      <tr>
        <td align="center">
          <table class="senlo-full-width" width="${contentWidth}" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:${contentWidth}px; margin: 0 auto; max-width: 100%;">
            <tr>
              <td align="left" style="font-size: 0;">
                ${renderedRows.join("")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// remove getLoopData function at the end
