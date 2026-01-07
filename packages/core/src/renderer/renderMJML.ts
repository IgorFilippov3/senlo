import { EmailDesignDocument, RowBlock, ColumnBlock } from "../emailDesign";
import { renderMJMLBlock } from "./mjmlBlocks";
import { renderPadding } from "./utils";
import { replaceMergeTags } from "../merge-tags";
import { RenderOptions } from "./types";

export function renderEmailDesignMJML(
  design: EmailDesignDocument,
  options?: RenderOptions
): string {
  const sections = design.rows.map((row) => renderMJMLSection(row)).join("\n");

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

function renderMJMLSection(row: RowBlock): string {
  const { settings } = row;
  const columns = row.columns.map((col) => renderMJMLColumn(col)).join("\n");
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

function renderMJMLColumn(column: ColumnBlock): string {
  const blocks = column.blocks.map((block) => renderMJMLBlock(block)).join("\n");

  return `
      <mj-column width="${column.width}%">
        ${blocks}
      </mj-column>`;
}





