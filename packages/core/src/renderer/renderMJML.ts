import { EmailDesignDocument, RowBlock, ColumnBlock } from "../emailDesign";
import { renderMJMLBlock } from "./mjmlBlocks";
import { renderPadding } from "./utils";
import { replaceMergeTags } from "../merge-tags";
import { RenderOptions, RenderContext } from "./types";
import { resolveVariable } from "./conditions";

export function renderEmailDesignMJML(
  design: EmailDesignDocument,
  options?: RenderOptions,
): string {
  const context: RenderContext = {
    responsiveStyles: [],
    options,
  };

  const sections = design.rows
    .map((row) => {
      if (row.loop) {
        const data = options?.data || {};
        const loopData = resolveVariable(row.loop.variable, data);

        if (Array.isArray(loopData)) {
          return loopData
            .map((item) => {
              const localContext = {
                ...context,
                localData: {
                  ...context.localData,
                  [row.loop!.alias]: item,
                },
              };
              let sectionMjml = renderMJMLSection(row, localContext);
              // Replace local tags immediately
              if (localContext.localData && options?.data) {
                sectionMjml = replaceMergeTags(
                  sectionMjml,
                  options.data,
                  localContext.localData,
                );
              }
              return sectionMjml;
            })
            .join("\n");
        }
        // In preview mode or editor, we might want to show at least one row or a message
        return "";
      }
      return renderMJMLSection(row, context);
    })
    .join("\n");

  let mjml = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${design.settings.fontFamily || "Arial, sans-serif"}" />
      <mj-text color="${design.settings.textColor || "#111827"}" />
    </mj-attributes>
    <mj-style>
      /* You can add custom styles here */
    </mj-style>
  </mj-head>
  <mj-body background-color="${design.settings.backgroundColor || "#ffffff"}" width="${design.settings.contentWidth || 600}px">
    ${sections}
  </mj-body>
</mjml>
  `.trim();

  if (options?.data) {
    mjml = replaceMergeTags(mjml, options.data);
  }

  return mjml;
}

function renderMJMLSection(row: RowBlock, context: RenderContext): string {
  const { settings } = row;
  const columns = row.columns
    .map((col) => renderMJMLColumn(col, context))
    .join("\n");
  const borderRadius = settings.borderRadius || { top: 0, bottom: 0 };
  const borderRadiusStr = `${borderRadius.top || 0}px ${borderRadius.top || 0}px ${borderRadius.bottom || 0}px ${borderRadius.bottom || 0}px`;

  return `
    <mj-section
      background-color="${settings.backgroundColor || "transparent"}"
      full-width="${settings.fullWidth ? "full-width" : "none"}"
      padding="${renderPadding(settings.padding)}"
      text-align="${settings.align || "center"}"
      border-radius="${borderRadiusStr}"
    >
      ${columns}
    </mj-section>`;
}

function renderMJMLColumn(column: ColumnBlock, context: RenderContext): string {
  const blocks = column.blocks
    .map((block) => renderMJMLBlock(block, context.options, context.localData))
    .join("\n");

  return `
      <mj-column width="${column.width}%">
        ${blocks}
      </mj-column>`;
}
// remove getLoopData at the end
