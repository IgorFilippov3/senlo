// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr, escapeMergeValue } from "../renderer/escape";
import { resolveVariable } from "../renderer/conditions";
import { registerStyleRule } from "../renderer/responsive";
import { globalsOf } from "../renderer/types";
import { colorInlineLinks, renderBox, renderPadding } from "../renderer/utils";
import type { RenderContext, RenderOptions } from "../renderer/types";
import {
  alignSchema,
  boxFallbacks,
  boxFields,
  contentConditionSchema,
  copy,
  paddingSchema,
  textStyleSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

/**
 * @fileoverview A table whose columns are described once.
 *
 * Built out of a row's columns, a table is two rows - a header and a body - that
 * have to agree about their widths, their behaviour on a phone and the rule
 * between them, with nothing keeping them level. Two of those three had already
 * drifted in practice.
 *
 * Two things also fall out of being a block rather than a pair of rows. It
 * cannot stack: stacking is `.senlo-stack`, which belongs to the inline-block
 * column `div`s a row emits, and this renders a real `<table>`, which simply
 * narrows. And its rules cannot break: one collapsed table draws a rule across
 * the row as a single border rather than as one segment per column that has to
 * meet its neighbours - the failure that a horizontal gap on any one cell used
 * to cause.
 */

/** A rule, in the shape `product-line` already uses for the same idea. */
const ruleSchema = z.object({
  width: z.number().int().nonnegative().optional(),
  style: z.enum(["solid", "dashed", "dotted"]).optional(),
  color: z.string().optional(),
});

export const tableColumnSchema = z.object({
  /** Which field of a data row this column shows. Ignored for typed rows. */
  key: z.string(),
  /** The header cell. A column with no label still occupies its width. */
  label: z.string().optional(),
  /** Percent of the table. The columns of a table add up to 100. */
  width: z.number().positive().max(100).optional(),
  align: alignSchema.optional(),
  /**
   * Type for this column's body cells, over the table's own. Only what is set
   * is overridden - a column that names a colour and nothing else keeps the
   * table's size and weight.
   *
   * Body cells only. The header is styled as a band, by `headerStyle`, and a
   * per-column header is a different thing that nobody has asked for; letting
   * this reach it would make the two settings fight over the same cell.
   */
  style: textStyleSchema.optional(),
});

/** Kept local: the document's own `TableColumn` is the exported name. */
type Column = z.infer<typeof tableColumnSchema>;

export const tableBlockDataSchema = z.object({
  columns: z.array(tableColumnSchema).min(1, "A table needs a column"),
  /**
   * Where the rows come from, when they come from data: a path resolved the
   * same way a merge tag is, so `custom.items` and an alias from an enclosing
   * loop both work.
   */
  source: z.string().optional(),
  /**
   * Rows typed in the panel, each a list of cells positional to the columns.
   * Used when `source` is unset - a comparison table or a spec list has no
   * variable behind it.
   */
  rows: z.array(z.array(z.string())).optional(),
  showHeader: z.boolean().optional(),
  headerStyle: textStyleSchema.optional(),
  headerBackgroundColor: z.string().optional(),
  /** The rule under the header; absent means none. */
  headerDivider: ruleSchema.optional(),
  /** The rule between body rows; absent means none. */
  rowDivider: ruleSchema.optional(),
  /** Space inside every cell. */
  cellPadding: paddingSchema.optional(),
  textStyle: textStyleSchema.optional(),
  /**
   * Type size below the document's width. The table keeps its columns on a
   * phone and narrows; this is the one lever for when narrowing alone is not
   * enough. Absent means the table adds nothing to the stylesheet.
   */
  mobileFontSize: z.number().positive().optional(),
  padding: paddingSchema.optional(),
  ...boxFields,
});

export type TableBlockData = z.infer<typeof tableBlockDataSchema>;

export const tableBlockFormSchema = tableBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const tableBlockFallbacks = {
  ...boxFallbacks,
  showHeader: true,
  headerBackgroundColor: null,
  headerStyle: {
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: "bold" as const,
    color: null,
  },
  textStyle: {
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: "normal" as const,
    color: null,
  },
  headerDivider: { width: 0, style: "solid" as const, color: "#e5e7eb" },
  rowDivider: { width: 1, style: "solid" as const, color: "#e5e7eb" },
  cellPadding: { top: 10, right: 8, bottom: 10, left: 8 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

/** What an author sees in the canvas before any data exists to fill the table. */
const PLACEHOLDER_ROWS = 2;

function columnsOf(data: any): Column[] {
  return Array.isArray(data?.columns) && data.columns.length
    ? data.columns
    : [{ key: "value" }];
}

/**
 * A cell's text, and whether it is to be trusted as markup.
 *
 * A typed cell is authored in the panel, like every other text field in this
 * product, so it holds HTML and a link in it is coloured like the rest of the
 * text. A cell that came from data is a recipient's value: it is escaped,
 * including `{`, so a value that happens to contain `{{...}}` cannot be read
 * back as a merge tag by the substitution that runs over the finished document.
 */
function cellsFromData(row: any, columns: Column[]): string[] {
  return columns.map((column) => {
    const value = row?.[column.key];
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return "";
    return escapeMergeValue(value);
  });
}

function cellsFromTyped(row: unknown, columns: Column[]): string[] {
  const cells = Array.isArray(row) ? row : [];
  // A row with fewer cells than columns pads on the right rather than letting
  // the rest shift left into the wrong column.
  return columns.map((_, i) => (typeof cells[i] === "string" ? cells[i] : ""));
}

/**
 * The body, and whether it is real.
 *
 * `placeholder` is true only in the canvas: a table bound to a variable has
 * nothing to show until preview data exists, and an author who has just dragged
 * one in should see its shape rather than an empty box. A message being sent
 * always has a data object, so an unresolved path there renders no rows at all
 * rather than sample ones.
 */
function bodyRows(
  data: any,
  columns: Column[],
  context: RenderContext,
): { rows: string[][]; placeholder: boolean } {
  if (data?.source) {
    const resolved = resolveVariable(
      data.source,
      context.options?.data ?? {},
      context.localData,
    );

    if (Array.isArray(resolved)) {
      return {
        rows: resolved.map((row) => cellsFromData(row, columns)),
        placeholder: false,
      };
    }

    if (context.options?.data) return { rows: [], placeholder: false };

    return {
      rows: Array.from({ length: PLACEHOLDER_ROWS }, () =>
        columns.map((column) => escapeMergeValue(column.key)),
      ),
      placeholder: true,
    };
  }

  const typed = Array.isArray(data?.rows) ? data.rows : [];
  return {
    rows: typed.map((row: unknown) => cellsFromTyped(row, columns)),
    placeholder: false,
  };
}

/** A rule as a CSS declaration, or nothing when it has no width. */
function ruleDeclaration(rule: any): string {
  const width = Number(rule?.width ?? 0);
  if (!Number.isFinite(width) || width <= 0) return "";

  return `border-bottom: ${Math.round(width)}px ${rule.style || "solid"} ${
    rule.color || "#e5e7eb"
  }`;
}

function renderTable(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  const columns = columnsOf(data);

  const fallbacks = tableBlockFallbacks;
  const textStyle = { ...fallbacks.textStyle, ...(data.textStyle || {}) };
  const headerStyle = { ...fallbacks.headerStyle, ...(data.headerStyle || {}) };
  const cellPadding = renderPadding(data.cellPadding ?? fallbacks.cellPadding);

  const headerColor = headerStyle.color || globals.textColor || "#000000";

  const { rows, placeholder } = bodyRows(data, columns, context);
  const showHeader = data.showHeader ?? fallbacks.showHeader;

  const rowRule = ruleDeclaration(data.rowDivider ?? fallbacks.rowDivider);
  const headerRule = ruleDeclaration(
    data.headerDivider ?? fallbacks.headerDivider,
  );

  // The one lever for a narrow screen. Nothing is registered and no class is
  // written when it is unset, so a table without it is the bytes it would have
  // been anyway.
  const mobileSize = Number(data.mobileFontSize);
  const mobileClass =
    Number.isFinite(mobileSize) && mobileSize > 0
      ? ` class="${registerStyleRule(
          context,
          "tbl",
          `font-size: ${Math.round(mobileSize)}px !important;`,
          {
            media: `only screen and (max-width: ${globals.contentWidth}px)`,
            // The cells, not the table: each one carries its own inline size,
            // which an inherited one cannot beat.
            within: "td",
          },
        )}"`
      : "";

  /** The table's type with the column's own laid over it, for a body cell. */
  const styleFor = (column: Column, isHeader: boolean) =>
    isHeader ? headerStyle : { ...textStyle, ...(column.style || {}) };

  const colorFor = (column: Column, isHeader: boolean) =>
    isHeader
      ? headerColor
      : column.style?.color || textStyle.color || globals.textColor || "#000000";

  const cell = (
    content: string,
    column: Column,
    isHeader: boolean,
    rule: string,
  ) => {
    const type = styleFor(column, isHeader);

    const style = [
      `text-align: ${column.align || "left"}`,
      `vertical-align: top`,
      `font-family: ${type.fontFamily || globals.fontFamily}`,
      `font-size: ${type.fontSize}px`,
      `line-height: ${type.lineHeight}`,
      `font-weight: ${type.fontWeight}`,
      `color: ${colorFor(column, isHeader)}`,
      `padding: ${cellPadding}`,
      // A long unbroken string in a narrow column would otherwise push the
      // table past its width rather than wrapping.
      `word-break: break-word`,
    ];

    if (isHeader && data.headerBackgroundColor) {
      style.push(`background-color: ${data.headerBackgroundColor}`);
    }
    if (column.width) style.push(`width: ${column.width}%`);
    if (rule) style.push(rule);

    const widthAttr = column.width ? ` width="${column.width}%"` : "";

    return `<td${widthAttr} style="${escapeAttr(style.join("; "))}">${content}</td>`;
  };

  const headerRow = showHeader
    ? `<tr>${columns
        .map((column) =>
          cell(
            colorInlineLinks(column.label ?? "", headerColor),
            column,
            true,
            headerRule,
          ),
        )
        .join("")}</tr>`
    : "";

  const bodyMarkup = rows
    .map((cells, index) => {
      // No rule under the last row: the table ends there, and a trailing line
      // reads as a border the author did not ask for.
      const rule = index === rows.length - 1 ? "" : rowRule;

      return `<tr>${columns
        .map((column, i) =>
          cell(
            placeholder || data.source
              ? cells[i]
              : colorInlineLinks(cells[i], colorFor(column, false)),
            column,
            false,
            rule,
          ),
        )
        .join("")}</tr>`;
    })
    .join("");

  const tableStyle = [
    `width: 100%`,
    `border-collapse: collapse`,
    `border-spacing: 0`,
  ].join("; ");

  return renderBox(
    `
    <div style="${escapeAttr(`padding: ${renderPadding(data.padding)}`)}">
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"${mobileClass} style="${escapeAttr(tableStyle)}">
        <tbody>${headerRow}${bodyMarkup}</tbody>
      </table>
    </div>
  `,
    data,
  );
}

/**
 * The MJML half. `mj-table` renders the table element itself and takes the rows
 * as its content, so this is the same markup without the wrapper.
 *
 * The export has no render context, so a table bound to a variable exports its
 * columns and no rows - the same thing the HTML path does when the path cannot
 * be resolved.
 */
function renderMJMLTable(block: any, _options?: RenderOptions): string {
  const { data } = block;
  const columns = columnsOf(data);
  const fallbacks = tableBlockFallbacks;
  const textStyle = { ...fallbacks.textStyle, ...(data.textStyle || {}) };
  const headerStyle = { ...fallbacks.headerStyle, ...(data.headerStyle || {}) };
  const cellPadding = renderPadding(data.cellPadding ?? fallbacks.cellPadding);

  const rowRule = ruleDeclaration(data.rowDivider ?? fallbacks.rowDivider);
  const headerRule = ruleDeclaration(
    data.headerDivider ?? fallbacks.headerDivider,
  );

  const cell = (content: string, column: Column, isHeader: boolean, rule: string) => {
    const type = isHeader
      ? headerStyle
      : { ...textStyle, ...(column.style || {}) };

    const style = [
      `text-align: ${column.align || "left"}`,
      `font-size: ${type.fontSize}px`,
      `font-weight: ${type.fontWeight}`,
      `padding: ${cellPadding}`,
    ];
    if (!isHeader && type.color) style.push(`color: ${type.color}`);
    if (isHeader && data.headerBackgroundColor) {
      style.push(`background-color: ${data.headerBackgroundColor}`);
    }
    if (column.width) style.push(`width: ${column.width}%`);
    if (rule) style.push(rule);

    return `<td style="${escapeAttr(style.join("; "))}">${content}</td>`;
  };

  const header = (data.showHeader ?? fallbacks.showHeader)
    ? `<tr>${columns.map((c) => cell(c.label ?? "", c, true, headerRule)).join("")}</tr>`
    : "";

  const typed = data.source || !Array.isArray(data.rows) ? [] : data.rows;
  const body = typed
    .map((row: unknown, index: number) => {
      const cells = cellsFromTyped(row, columns);
      const rule = index === typed.length - 1 ? "" : rowRule;
      return `<tr>${columns.map((c, i) => cell(cells[i], c, false, rule)).join("")}</tr>`;
    })
    .join("");

  return `
        <mj-table padding="${renderPadding(data.padding)}" cellpadding="0" cellspacing="0">
          ${header}${body}
        </mj-table>`;
}

export const tableBlock: BlockDefinition = {
  type: "table",
  label: "Table",
  fallbacks: tableBlockFallbacks,
  createDefaults: () =>
    copy({
      columns: [
        { key: "description", label: "Description", width: 50, align: "left" as const },
        { key: "qty", label: "Qty", width: 20, align: "right" as const },
        { key: "amount", label: "Amount", width: 30, align: "right" as const },
      ],
      // Typed rows by default, so a table shows something the moment it is
      // dropped in rather than waiting for data to be bound to it.
      rows: [
        ["First item", "1", "$0.00"],
        ["Second item", "2", "$0.00"],
      ],
      showHeader: true,
      rowDivider: { width: 1, style: "solid" as const, color: "#e5e7eb" },
      cellPadding: { top: 10, right: 8, bottom: 10, left: 8 },
      padding: { top: 10, right: 0, bottom: 10, left: 0 },
    }),
  dataSchema: tableBlockDataSchema,
  renderHTML: renderTable,
  renderMJML: renderMJMLTable,
  describe: (block: any) => {
    const count = columnsOf(block?.data).length;
    return `Table · ${count} column${count === 1 ? "" : "s"}`;
  },
};
