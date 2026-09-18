import { EmailDesignDocument, RowBlock, ColumnBlock } from "../emailDesign";
import { renderMJMLBlock } from "./mjmlBlocks";
import { hasMargin, renderPadding } from "./utils";
import { replaceMergeTags } from "../merge-tags";
import { escapeAttr, escapeCssValue } from "./escape";
import { evaluateCondition } from "./conditions";
import { RenderOptions, RenderContext, globalsOf, resolveGlobals } from "./types";
import { resolveVariable } from "./conditions";
import { migrateEmailDesign } from "../migrations";

export function renderEmailDesignMJML(
  rawDesign: EmailDesignDocument,
  options?: RenderOptions,
): string {
  const design = migrateEmailDesign(rawDesign);

  const context: RenderContext = {
    responsiveStyles: [],
    options,
    globals: resolveGlobals(design.settings),
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
      <mj-all font-family="${escapeCssValue(design.settings.fontFamily) || "Arial, Helvetica, sans-serif"}" />
      <mj-text color="${escapeAttr(design.settings.textColor || "#111827")}" />
    </mj-attributes>
    <mj-style>
      /* You can add custom styles here */
    </mj-style>
  </mj-head>
  <mj-body background-color="${escapeAttr(design.settings.backgroundColor || "#ffffff")}" width="${Number(design.settings.contentWidth) || 600}px">
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
  // Same rule as the HTML path: a row whose condition is false is not part of
  // the message, so it is not part of the export either.
  if (!evaluateCondition(row.condition, context)) return "";

  const { settings } = row;
  const columns = row.columns
    .map((col) => renderMJMLColumn(col, context))
    .join("\n");
  const borderRadius = settings.borderRadius || { top: 0, bottom: 0 };
  const borderRadiusStr = `${borderRadius.top || 0}px ${borderRadius.top || 0}px ${borderRadius.bottom || 0}px ${borderRadius.bottom || 0}px`;

  // MJML takes a section's width from `mj-body`: there is no per-section width
  // to set. A narrow row is therefore approximated by insetting it, which puts
  // the content where the HTML path puts it but paints the inset in the row's
  // background rather than leaving it transparent. The HTML path is what gets
  // sent; this export is a convenience, and this is where the two differ.
  const contentWidth = globalsOf(context).contentWidth;
  const width = Math.min(Number(settings.width) || contentWidth, contentWidth);
  const inset = Math.max(0, Math.round((contentWidth - width) / 2));
  const padding = settings.padding || {};
  const paddingStr = renderPadding({
    ...padding,
    left: (padding.left || 0) + inset,
    right: (padding.right || 0) + inset,
  });

  const section = `
    <mj-section
      background-color="${escapeAttr(settings.backgroundColor || "transparent")}"
      full-width="${settings.fullWidth ? "full-width" : "none"}"
      padding="${paddingStr}"
      text-align="${escapeAttr(settings.align || "center")}"
      border-radius="${borderRadiusStr}"
    >
      ${columns}
    </mj-section>`;

  // The gap outside the row's background. It cannot be folded into the
  // section's own padding the way `renderMJMLBox` folds a block's, because a
  // section with a background would paint the gap in its own colour. A wrapper
  // is the MJML element that pads from the outside, so a row with a margin
  // gets one and a row without one is left alone.
  if (!hasMargin(settings.margin)) return section;

  return `
    <mj-wrapper padding="${renderPadding(settings.margin)}">
      ${section}
    </mj-wrapper>`;
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
