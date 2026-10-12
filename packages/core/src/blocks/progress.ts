// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { ProgressStep } from "../emailDesign";
import { escapeAttr } from "../renderer/escape";
import { resolveVariable } from "../renderer/conditions";
import { registerStyleRule } from "../renderer/responsive";
import { globalsOf } from "../renderer/types";
import { renderBox, renderPadding } from "../renderer/utils";
import type { RenderContext, RenderOptions } from "../renderer/types";
import {
  alignSchema,
  boxFallbacks,
  boxFields,
  contentConditionSchema,
  copy,
  cssColorSchema,
  paddingSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

/**
 * @fileoverview A horizontal bar split into steps, with an optional label under
 * each one - an order's journey, an application's review, a setup checklist.
 *
 * The template does not know which statuses a company has, so the author
 * describes the steps (a label for the recipient, a value for the code) and
 * names the variable the status arrives in. Which step is lit is decided per
 * message: the steps up to the status are completed, the status itself is
 * active, the rest are pending.
 *
 * In the canvas there is no message, so each step is drawn in the state the
 * author picked for it (`previewState`, completed when unset) - a way to see
 * and tune all six colours without mock data. The MJML export is a template,
 * not a preview, so it draws every step completed.
 *
 * A message whose status is missing or matches no step drops the block
 * entirely. An unknown status usually means something left the happy path - a
 * return, a cancellation - and a bar that guesses would tell the recipient
 * something untrue.
 *
 * Like the table block it is a real `<table>`, so it narrows on a phone instead
 * of stacking. Each segment is a cell with `bgcolor` and a fixed height rather
 * than a `div`: Outlook's Word engine draws neither a div's height nor its
 * background. Rounded ends are an enhancement Outlook drops.
 */

export const progressStepSchema = z.object({
  /** What the recipient reads under the segment. May be empty. */
  label: z.string(),
  /** The status code that selects this step, as the sender's data spells it. */
  value: z.string().trim().min(1, "Value is required"),
  /**
   * How the canvas draws this step, so the author can see and tune every
   * colour. Absent means completed. A message never reads it - there the
   * status decides - and neither does the export.
   */
  previewState: z.enum(["completed", "active", "pending"]).optional(),
});

export const progressBlockDataSchema = z.object({
  steps: z
    .array(progressStepSchema)
    .min(1, "Add at least one step")
    .superRefine((steps, ctx) => {
      const seen = new Map<string, number>();
      steps.forEach((step, index) => {
        const key = normalize(step.value);
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Value "${step.value}" is already used by step ${seen.get(key)! + 1}`,
            path: [index, "value"],
          });
        } else {
          seen.set(key, index);
        }
      });
    }),
  /**
   * Where the status is read from - a path resolved the way a merge tag is
   * (`custom.shipment.status`), so an alias from an enclosing loop works too.
   * Braces are tolerated: `{{custom.shipment.status}}` reads the same.
   */
  statusVariable: z.string().optional(),

  /** Bar segments. */
  completedColor: cssColorSchema.optional(),
  activeColor: cssColorSchema.optional(),
  pendingColor: cssColorSchema.optional(),

  /** Labels. `null` fallbacks mean the document's text colour. */
  completedLabelColor: cssColorSchema.optional(),
  activeLabelColor: cssColorSchema.optional(),
  pendingLabelColor: cssColorSchema.optional(),

  barHeight: z.number().int().positive().optional(),
  barRadius: z.number().int().nonnegative().optional(),
  /** Space between two segments, in pixels. */
  gap: z.number().int().nonnegative().optional(),
  showLabels: z.boolean().optional(),
  labelAlign: alignSchema.optional(),
  /** Space between the bar and its labels. */
  labelSpacing: z.number().int().nonnegative().optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
  /** Label size below the document's width. Absent adds nothing to the stylesheet. */
  mobileFontSize: z.number().positive().optional(),
  padding: paddingSchema.optional(),
  ...boxFields,
});

export type ProgressBlockData = z.infer<typeof progressBlockDataSchema>;

export const progressBlockFormSchema = progressBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const progressBlockFallbacks = {
  ...boxFallbacks,
  statusVariable: "",
  completedColor: "#16a34a",
  activeColor: "#16a34a",
  pendingColor: "#e4e4e7",
  completedLabelColor: null,
  activeLabelColor: "#16a34a",
  pendingLabelColor: "#a1a1aa",
  barHeight: 6,
  barRadius: 3,
  gap: 6,
  showLabels: true,
  labelAlign: "left" as const,
  labelSpacing: 8,
  fontSize: 12,
  lineHeight: 1.4,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

/**
 * Statuses are compared without case or surrounding space: `"Shipped"` and
 * `"shipped "` are the same status to anyone sending one.
 */
function normalize(value: unknown): string {
  return String(value).trim().toLowerCase();
}

function stepsOf(data: any): ProgressStep[] {
  return Array.isArray(data?.steps)
    ? data.steps.filter(
        (step: any) => step && typeof step.label === "string",
      )
    : [];
}

/** `custom.shipment.status`, with or without the braces of a merge tag. */
function variablePath(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "").trim();
}

/**
 * The 1-based step a status selects, or `null` when it selects none. Only a
 * step's value is matched: a status is the sender's code, never a position.
 */
export function resolveProgressStep(
  steps: ProgressStep[],
  status: unknown,
): number | null {
  if (status === undefined || status === null) return null;
  if (typeof status === "object") return null;

  const needle = normalize(status);
  if (!needle) return null;

  const index = steps.findIndex(
    (step) => typeof step.value === "string" && normalize(step.value) === needle,
  );
  return index === -1 ? null : index + 1;
}

type StepState = "completed" | "active" | "pending";

const STEP_STATES: StepState[] = ["completed", "active", "pending"];

/** Where a block is being drawn, which decides where its states come from. */
type Surface = "render" | "export";

/**
 * The state of every step, or `null` when the block is not to be drawn.
 *
 * A message always carries a data object, and there the status decides; a
 * missing or unknown one hides the block. Without a data object it is the
 * canvas, which draws each step's `previewState`, or the export, which draws
 * every step completed.
 */
function statesFor(
  data: any,
  steps: ProgressStep[],
  context: RenderContext | undefined,
  surface: Surface,
): StepState[] | null {
  const messageData = context?.options?.data;
  if (!messageData) {
    if (surface === "export") return steps.map(() => "completed");
    return steps.map((step) =>
      STEP_STATES.includes(step.previewState as StepState)
        ? (step.previewState as StepState)
        : "completed",
    );
  }

  const path = variablePath(data?.statusVariable);
  if (!path) return null;

  const status = resolveVariable(path, messageData, context?.localData);
  const current = resolveProgressStep(steps, status);
  if (current === null) return null;

  return steps.map((_, index) => {
    const step = index + 1;
    if (step < current) return "completed";
    if (step === current) return "active";
    return "pending";
  });
}

interface Resolved {
  steps: ProgressStep[];
  states: StepState[];
  bar: Record<StepState, string>;
  label: Record<StepState, string>;
  barHeight: number;
  barRadius: number;
  gap: number;
  showLabels: boolean;
  labelAlign: string;
  labelSpacing: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

function resolve(
  block: any,
  context: RenderContext | undefined,
  surface: Surface = "render",
): Resolved | null {
  const data = block?.data ?? {};
  const steps = stepsOf(data);
  if (!steps.length) return null;

  const states = statesFor(data, steps, context, surface);
  if (!states) return null;

  const f = progressBlockFallbacks;
  const globals = context ? globalsOf(context) : undefined;
  const textColor = globals?.textColor || "#000000";

  const int = (value: unknown, fallback: number) => {
    const n = Number(value);
    return value !== undefined && value !== null && Number.isFinite(n) && n >= 0
      ? Math.round(n)
      : fallback;
  };
  const positive = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return {
    steps,
    states,
    bar: {
      completed: data.completedColor || f.completedColor,
      active: data.activeColor || f.activeColor,
      pending: data.pendingColor || f.pendingColor,
    },
    label: {
      completed: data.completedLabelColor || textColor,
      active: data.activeLabelColor || f.activeLabelColor,
      pending: data.pendingLabelColor || f.pendingLabelColor,
    },
    barHeight: Math.max(1, int(data.barHeight, f.barHeight)),
    barRadius: int(data.barRadius, f.barRadius),
    gap: int(data.gap, f.gap),
    showLabels: data.showLabels ?? f.showLabels,
    labelAlign: data.labelAlign || f.labelAlign,
    labelSpacing: int(data.labelSpacing, f.labelSpacing),
    fontSize: positive(data.fontSize, f.fontSize),
    lineHeight: positive(data.lineHeight, f.lineHeight),
    fontFamily: globals?.fontFamily || "Arial, Helvetica, sans-serif",
  };
}

/**
 * Half the gap on each inner side and none on the outer edges, so the bar
 * starts and ends flush with the column like any other block.
 */
function sidePadding(index: number, count: number, gap: number): string {
  const half = gap / 2;
  const left = index === 0 ? 0 : half;
  const right = index === count - 1 ? 0 : half;
  return `padding-left: ${left}px; padding-right: ${right}px`;
}

/** The bar row and the label row; shared by the HTML and MJML paths. */
function progressRows(r: Resolved): string {
  const count = r.steps.length;
  const width = Math.floor((100 / count) * 100) / 100;

  const segments = r.states
    .map((state, index) => {
      const color = r.bar[state];
      const barStyle = [
        `height: ${r.barHeight}px`,
        `line-height: ${r.barHeight}px`,
        `mso-line-height-rule: exactly`,
        `font-size: 0`,
        `background-color: ${color}`,
        r.barRadius ? `border-radius: ${r.barRadius}px` : "",
      ]
        .filter(Boolean)
        .join("; ");

      const cellStyle = `width: ${width}%; ${sidePadding(index, count, r.gap)}; vertical-align: top`;

      return `<td width="${width}%" style="${escapeAttr(cellStyle)}"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; width: 100%"><tr><td height="${r.barHeight}" bgcolor="${escapeAttr(color)}" style="${escapeAttr(barStyle)}">&nbsp;</td></tr></table></td>`;
    })
    .join("");

  if (!r.showLabels) return `<tr>${segments}</tr>`;

  const labels = r.states
    .map((state, index) => {
      const style = [
        `width: ${width}%`,
        sidePadding(index, count, r.gap),
        `padding-top: ${r.labelSpacing}px`,
        `vertical-align: top`,
        `text-align: ${r.labelAlign}`,
        `font-family: ${r.fontFamily}`,
        `font-size: ${r.fontSize}px`,
        `line-height: ${r.lineHeight}`,
        `color: ${r.label[state]}`,
        `word-break: break-word`,
      ].join("; ");

      // Authored in the panel like every other text field, so it is markup: a
      // merge tag or a <br> in a label is the author's intent.
      return `<td width="${width}%" style="${escapeAttr(style)}">${r.steps[index].label}</td>`;
    })
    .join("");

  return `<tr>${segments}</tr><tr>${labels}</tr>`;
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** What a screen reader announces instead of reading a grid of empty cells. */
function summaryOf(r: Resolved): string {
  const active = r.states.indexOf("active");
  if (active === -1) return `${r.steps.length} steps`;
  const label = plainText(r.steps[active].label);
  return `Step ${active + 1} of ${r.steps.length}${label ? `: ${label}` : ""}`;
}

function renderProgress(block: any, context: RenderContext): string {
  const r = resolve(block, context);
  if (!r) return "";

  const { data } = block;
  const globals = globalsOf(context);
  const mobileSize = Number(data.mobileFontSize);
  const mobileClass =
    r.showLabels && Number.isFinite(mobileSize) && mobileSize > 0
      ? ` class="${registerStyleRule(
          context,
          "prg",
          `font-size: ${Math.round(mobileSize)}px !important;`,
          {
            media: `only screen and (max-width: ${globals.contentWidth}px)`,
            // The cells: each carries its own inline size, which an inherited
            // one cannot beat.
            within: "td",
          },
        )}"`
      : "";

  const tableStyle = [
    `width: 100%`,
    `border-collapse: collapse`,
    `border-spacing: 0`,
    `table-layout: fixed`,
  ].join("; ");

  return renderBox(
    `
    <div style="${escapeAttr(`padding: ${renderPadding(data.padding)}`)}">
      <table role="img" aria-label="${escapeAttr(summaryOf(r))}" width="100%" border="0" cellpadding="0" cellspacing="0"${mobileClass} style="${escapeAttr(tableStyle)}">
        <tbody>${progressRows(r)}</tbody>
      </table>
    </div>
  `,
    data,
  );
}

/**
 * The MJML half. The export is a template, not a message or a preview, so
 * every step is drawn completed and the authored preview states stay behind.
 */
function renderMJMLProgress(block: any, _options?: RenderOptions): string {
  const r = resolve(block, undefined, "export");
  if (!r) return "";

  return `
        <mj-table padding="${renderPadding(block?.data?.padding)}" cellpadding="0" cellspacing="0" table-layout="fixed">
          ${progressRows(r)}
        </mj-table>`;
}

export const progressBlock: BlockDefinition = {
  type: "progress",
  label: "Progress",
  fallbacks: progressBlockFallbacks,
  createDefaults: () =>
    copy({
      steps: [
        // Mixed preview states, so a block that has just been dropped in
        // already shows all three colours of the bar and of the labels.
        { label: "Ordered", value: "ordered", previewState: "completed" as const },
        { label: "Shipped", value: "shipped", previewState: "completed" as const },
        { label: "Out for delivery", value: "out_for_delivery", previewState: "active" as const },
        { label: "Delivered", value: "delivered", previewState: "pending" as const },
      ],
      statusVariable: "",
      completedColor: "#16a34a",
      activeColor: "#16a34a",
      pendingColor: "#e4e4e7",
      activeLabelColor: "#16a34a",
      pendingLabelColor: "#a1a1aa",
      barHeight: 6,
      barRadius: 3,
      gap: 6,
      showLabels: true,
      labelAlign: "left" as const,
      labelSpacing: 8,
      fontSize: 12,
      padding: { top: 10, right: 0, bottom: 10, left: 0 },
    }),
  dataSchema: progressBlockDataSchema,
  renderHTML: renderProgress,
  renderMJML: renderMJMLProgress,
  describe: (block: any) => {
    const count = stepsOf(block?.data).length;
    return `Progress · ${count} step${count === 1 ? "" : "s"}`;
  },
};
