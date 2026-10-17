// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { RenderContext } from "../../renderer/types";
import { renderEmailDesign } from "../../renderer/renderEmailDesign";
import { getBlockDefinition } from "../registry";
import {
  previewStatusOf,
  progressBlockDataSchema,
  resolveProgressStep,
  withProgressPreviewStatus,
  withProgressPreviewStatusForBlock,
} from "../progress";

const definition = getBlockDefinition("progress")!;

const STEPS = [
  { label: "Ordered", value: "ordered" },
  { label: "Shipped", value: "shipped" },
  { label: "Out for delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
];

/** The same steps, each with a preview state as the author might set them. */
const PREVIEWED = STEPS.map((step, i) => ({
  ...step,
  previewState: (["completed", "active", "pending", undefined] as const)[i],
}));

const COLORS = {
  completedColor: "#111111",
  activeColor: "#222222",
  pendingColor: "#333333",
  completedLabelColor: "#444444",
  activeLabelColor: "#555555",
  pendingLabelColor: "#666666",
};

const block = (data: any) => ({
  id: "p1",
  type: "progress",
  data: { steps: STEPS, statusVariable: "custom.status", ...COLORS, ...data },
});

const render = (data: any, context?: Partial<RenderContext>) =>
  definition.renderHTML(block(data), {
    responsiveStyles: [],
    ...context,
  } as RenderContext);

/** As the canvas renders it: no data object at all. */
const canvas = (data: any = {}) => render(data);

/** As a message renders it: there is always a data object. */
const send = (custom: Record<string, any>, data: any = {}) =>
  render(data, { options: { data: { custom } } as any });

/** The colour of each bar segment, in order. */
const segments = (html: string) =>
  [...html.matchAll(/<td height="\d+" bgcolor="([^"]+)"/g)].map((m) => m[1]);

/** The colour of each label, in order. */
const labelColors = (html: string) =>
  [...html.matchAll(/color: (#[0-9a-f]{6}); word-break[^>]*>/g)].map((m) => m[1]);

const ariaLabel = (html: string) => html.match(/aria-label="([^"]*)"/)?.[1];

describe("resolveProgressStep", () => {
  it("finds the step whose value is the status", () => {
    expect(resolveProgressStep(STEPS, "out_for_delivery")).toBe(3);
  });

  it("ignores case and surrounding space", () => {
    expect(resolveProgressStep(STEPS, "  Shipped ")).toBe(2);
  });

  it("never reads a status as a position", () => {
    expect(resolveProgressStep(STEPS, 2)).toBeNull();
    expect(resolveProgressStep(STEPS, "1")).toBeNull();
  });

  it("matches a numeric status when a step's value is that number", () => {
    const steps = [
      { label: "New", value: "10" },
      { label: "Done", value: "20" },
    ];
    expect(resolveProgressStep(steps, 20)).toBe(2);
  });

  it("returns null for anything that names no step", () => {
    expect(resolveProgressStep(STEPS, undefined)).toBeNull();
    expect(resolveProgressStep(STEPS, null)).toBeNull();
    expect(resolveProgressStep(STEPS, "")).toBeNull();
    expect(resolveProgressStep(STEPS, "returned")).toBeNull();
    expect(resolveProgressStep(STEPS, { status: "shipped" })).toBeNull();
  });
});

describe("in the canvas", () => {
  it("draws every step as completed", () => {
    const html = canvas();
    expect(segments(html)).toEqual(Array(4).fill(COLORS.completedColor));
    expect(labelColors(html)).toEqual(Array(4).fill(COLORS.completedLabelColor));
  });

  it("draws the bar even before a status variable is chosen", () => {
    expect(segments(canvas({ statusVariable: "" }))).toHaveLength(4);
  });

  it("draws each step in the preview state the author picked", () => {
    const html = canvas({ steps: PREVIEWED });
    expect(segments(html)).toEqual([
      COLORS.completedColor,
      COLORS.activeColor,
      COLORS.pendingColor,
      COLORS.completedColor,
    ]);
    expect(labelColors(html)).toEqual([
      COLORS.completedLabelColor,
      COLORS.activeLabelColor,
      COLORS.pendingLabelColor,
      COLORS.completedLabelColor,
    ]);
  });

  it("treats an unknown preview state as completed", () => {
    const html = canvas({ steps: [{ label: "A", value: "a", previewState: "bogus" }] });
    expect(segments(html)).toEqual([COLORS.completedColor]);
  });

  it("starts a new block with all three states on show", () => {
    const html = definition.renderHTML(
      { id: "p1", type: "progress", data: definition.createDefaults() },
      { responsiveStyles: [] } as RenderContext,
    );
    expect(segments(html)).toEqual(["#16a34a", "#16a34a", "#16a34a", "#e4e4e7"]);
    expect(labelColors(html)).toEqual(["#000000", "#000000", "#16a34a", "#a1a1aa"]);
  });
});

describe("preview states outside the canvas", () => {
  it("never reach a message: the status decides", () => {
    const html = send({ status: "delivered" }, { steps: PREVIEWED });
    expect(segments(html)).toEqual([
      COLORS.completedColor,
      COLORS.completedColor,
      COLORS.completedColor,
      COLORS.activeColor,
    ]);
  });

  it("do not keep a block with an unknown status visible", () => {
    expect(send({ status: "returned" }, { steps: PREVIEWED }).trim()).toBe("");
  });
});

describe("in a message", () => {
  it("completes the steps before the status, activates it, leaves the rest pending", () => {
    const html = send({ status: "out_for_delivery" });

    expect(segments(html)).toEqual([
      COLORS.completedColor,
      COLORS.completedColor,
      COLORS.activeColor,
      COLORS.pendingColor,
    ]);
    expect(labelColors(html)).toEqual([
      COLORS.completedLabelColor,
      COLORS.completedLabelColor,
      COLORS.activeLabelColor,
      COLORS.pendingLabelColor,
    ]);
  });

  it("activates the first step with everything after it pending", () => {
    expect(segments(send({ status: "ordered" }))).toEqual([
      COLORS.activeColor,
      COLORS.pendingColor,
      COLORS.pendingColor,
      COLORS.pendingColor,
    ]);
  });

  it("activates the last step with everything before it completed", () => {
    expect(segments(send({ status: "delivered" }))).toEqual([
      COLORS.completedColor,
      COLORS.completedColor,
      COLORS.completedColor,
      COLORS.activeColor,
    ]);
  });

  it("reads a nested path, with or without merge-tag braces", () => {
    const custom = { shipment: { status: "shipped" } };
    expect(segments(send(custom, { statusVariable: "custom.shipment.status" }))[1]).toBe(COLORS.activeColor);
    expect(segments(send(custom, { statusVariable: "{{ custom.shipment.status }}" }))[1]).toBe(COLORS.activeColor);
  });

  it("reads an alias from an enclosing loop", () => {
    const html = render(
      { statusVariable: "order.status" },
      { options: { data: {} } as any, localData: { order: { status: "shipped" } } },
    );
    expect(segments(html)[1]).toBe(COLORS.activeColor);
  });

  it("hides the block when the status is missing", () => {
    expect(send({}).trim()).toBe("");
  });

  it("hides the block when the status matches no step", () => {
    expect(send({ status: "returned" }).trim()).toBe("");
  });

  it("hides the block when no status variable was chosen", () => {
    expect(send({ status: "shipped" }, { statusVariable: "" }).trim()).toBe("");
  });

  it("hides the block's box with it, margin and all", () => {
    const html = send({ status: "returned" }, { backgroundColor: "#fafafa", margin: { top: 20 } });
    expect(html.trim()).toBe("");
  });
});

describe("colours", () => {
  it("falls back to green, green and grey, with done labels in the text colour", () => {
    const html = definition.renderHTML(
      { id: "p1", type: "progress", data: { steps: STEPS, statusVariable: "custom.status" } },
      {
        responsiveStyles: [],
        options: { data: { custom: { status: "shipped" } } },
        globals: { fontFamily: "Arial", textColor: "#123456", contentWidth: 600 },
      } as any,
    );
    expect(segments(html)).toEqual(["#16a34a", "#16a34a", "#e4e4e7", "#e4e4e7"]);
    expect(labelColors(html)).toEqual(["#123456", "#16a34a", "#a1a1aa", "#a1a1aa"]);
  });
});

describe("labels", () => {
  it("can be turned off, leaving only the bar", () => {
    const html = canvas({ showLabels: false });
    expect(html).not.toContain("Ordered");
    expect(segments(html)).toHaveLength(4);
  });

  it("may be empty for a step", () => {
    const html = canvas({ steps: [{ label: "", value: "a" }, { label: "B", value: "b" }] });
    expect(segments(html)).toHaveLength(2);
  });

  it("keeps a label's markup, since the author wrote it", () => {
    const html = canvas({ steps: [{ label: "Ordered<br>Oct 9", value: "a" }, { label: "B", value: "b" }] });
    expect(html).toContain("Ordered<br>Oct 9");
  });

  it("summarises the state for a screen reader", () => {
    expect(ariaLabel(send({ status: "out_for_delivery" }))).toBe("Step 3 of 4: Out for delivery");
    expect(ariaLabel(canvas())).toBe("4 steps");
  });
});

describe("layout", () => {
  it("splits the width evenly between the steps", () => {
    expect((canvas().match(/width="25%"/g) || []).length).toBe(8);
  });

  it("puts half the gap on inner sides and none on the outer edges", () => {
    const html = canvas({ gap: 10 });
    expect(html).toContain("padding-left: 0px; padding-right: 5px");
    expect(html).toContain("padding-left: 5px; padding-right: 5px");
    expect(html).toContain("padding-left: 5px; padding-right: 0px");
  });

  it("allows no gap at all", () => {
    expect(canvas({ gap: 0 })).not.toContain("padding-right: 3px");
  });

  it("draws a segment as a cell with bgcolor and a fixed height, for Outlook", () => {
    const html = canvas({ barHeight: 8 });
    expect(html).toContain(`<td height="8" bgcolor="${COLORS.completedColor}"`);
    expect(html).toContain("mso-line-height-rule: exactly");
  });

  it("registers a mobile font size only when one is set", () => {
    const context = { responsiveStyles: [] as string[] };
    render({}, context);
    expect(context.responsiveStyles).toHaveLength(0);

    render({ mobileFontSize: 10 }, context);
    expect(context.responsiveStyles.join("")).toContain("font-size: 10px !important");
  });

  it("renders nothing without steps", () => {
    expect(canvas({ steps: [] }).trim()).toBe("");
  });
});

describe("schema", () => {
  it("accepts the defaults", () => {
    expect(progressBlockDataSchema.safeParse(definition.createDefaults()).success).toBe(true);
  });

  it("requires a value on every step", () => {
    const result = progressBlockDataSchema.safeParse({
      steps: [{ label: "A", value: "a" }, { label: "B", value: "  " }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects two steps with the same value, ignoring case", () => {
    const result = progressBlockDataSchema.safeParse({
      steps: [{ label: "A", value: "shipped" }, { label: "B", value: "Shipped" }],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("already used by step 1");
  });

  it("requires at least one step", () => {
    expect(progressBlockDataSchema.safeParse({ steps: [] }).success).toBe(false);
  });

  it("rejects a colour that could smuggle in a declaration", () => {
    const result = progressBlockDataSchema.safeParse({
      steps: STEPS,
      activeColor: "red; background-image: url(x)",
    });
    expect(result.success).toBe(false);
  });
});

describe("in a whole message", () => {
  const design = {
    version: 4,
    settings: {},
    rows: [
      {
        id: "r1",
        type: "row" as const,
        settings: {},
        columns: [
          {
            id: "c1",
            width: 100,
            blocks: [
              {
                id: "p1",
                type: "progress" as const,
                data: { steps: STEPS, statusVariable: "custom.shipment.status" },
              },
            ],
          },
        ],
      },
    ],
  };

  it("resolves the status from the message's data", () => {
    const html = renderEmailDesign(design, {
      data: { custom: { shipment: { status: "out_for_delivery" } } },
    });
    expect(segments(html)).toEqual(["#16a34a", "#16a34a", "#16a34a", "#e4e4e7"]);
  });

  it("drops the block from a message whose status is unknown", () => {
    const html = renderEmailDesign(design, {
      data: { custom: { shipment: { status: "cancelled" } } },
    });
    expect(segments(html)).toHaveLength(0);
    expect(html).not.toContain("Ordered");
  });
});

describe("MJML export", () => {
  it("exports every step completed", () => {
    const mjml = definition.renderMJML(block({}));
    expect(mjml).toContain("<mj-table");
    expect(segments(mjml)).toEqual(Array(4).fill(COLORS.completedColor));
  });

  it("leaves the preview states behind", () => {
    const mjml = definition.renderMJML(block({ steps: PREVIEWED }));
    expect(segments(mjml)).toEqual(Array(4).fill(COLORS.completedColor));
  });
});

describe("preview data", () => {
  const steps = (...states: Array<"completed" | "active" | "pending" | undefined>) =>
    STEPS.map((step, i) => ({ ...step, previewState: states[i] }));

  describe("previewStatusOf", () => {
    it("takes the step marked active", () => {
      expect(previewStatusOf(steps("completed", "completed", "active", "pending"))).toBe("out_for_delivery");
    });

    it("takes the last completed step when none is active", () => {
      expect(previewStatusOf(steps("completed", "completed", "pending", "pending"))).toBe("shipped");
      expect(previewStatusOf(STEPS)).toBe("delivered");
    });

    it("falls back to the first step when every step is pending", () => {
      expect(previewStatusOf(steps("pending", "pending", "pending", "pending"))).toBe("ordered");
    });

    it("has nothing to offer without steps", () => {
      expect(previewStatusOf([])).toBeUndefined();
    });
  });

  const bar = (data: any = {}) => ({
    type: "progress",
    data: {
      steps: steps("completed", "completed", "active", "pending"),
      statusVariable: "custom.shipment.status",
      ...data,
    },
  });

  describe("withProgressPreviewStatusForBlock", () => {
    it("fills in a missing status from the active step", () => {
      const data = { custom: { name: "Amelia" } };
      const seeded = withProgressPreviewStatusForBlock(data, bar());
      expect(seeded.custom).toEqual({ name: "Amelia", shipment: { status: "out_for_delivery" } });
    });

    it("leaves the original data untouched", () => {
      const custom = { name: "Amelia" };
      const data = { contact: custom, custom };
      withProgressPreviewStatusForBlock(data, bar());
      expect(custom).toEqual({ name: "Amelia" });
      expect(data.contact).toBe(custom);
    });

    it("keeps a status the mock data already has", () => {
      const data = { custom: { shipment: { status: "ordered" } } };
      expect(withProgressPreviewStatusForBlock(data, bar())).toBe(data);
    });

    it("keeps even a status that matches no step, so its effect can be previewed", () => {
      const data = { custom: { shipment: { status: "returned" } } };
      expect(withProgressPreviewStatusForBlock(data, bar())).toBe(data);
    });

    it("accepts a path written as a merge tag", () => {
      const seeded = withProgressPreviewStatusForBlock({ custom: {} }, bar({ statusVariable: "{{custom.order.state}}" }));
      expect(seeded.custom).toEqual({ order: { state: "out_for_delivery" } });
    });

    it("does nothing without a status variable", () => {
      const data = { custom: {} };
      expect(withProgressPreviewStatusForBlock(data, bar({ statusVariable: "" }))).toBe(data);
    });

    it("leaves a path that starts at a loop alias alone", () => {
      const data = { custom: {} };
      const block = bar({ statusVariable: "order.status" });
      expect(withProgressPreviewStatusForBlock(data, block, { order: {} })).toBe(data);
    });

    it("ignores every other block type", () => {
      const data = { custom: {} };
      expect(withProgressPreviewStatusForBlock(data, { type: "paragraph", data: { text: "x" } })).toBe(data);
    });

    it("makes the bar render the way the canvas draws it", () => {
      const block = bar(COLORS);
      const seeded = withProgressPreviewStatusForBlock({ custom: {} }, block);
      const html = definition.renderHTML(
        { id: "p1", type: "progress", data: block.data },
        { responsiveStyles: [], options: { data: seeded } } as any,
      );
      expect(segments(html)).toEqual([
        COLORS.completedColor,
        COLORS.completedColor,
        COLORS.activeColor,
        COLORS.pendingColor,
      ]);
    });
  });

  describe("withProgressPreviewStatus", () => {
    const design = (rows: any[]) => ({ rows });
    const rowWith = (blocks: any[], extra: any = {}) => ({ columns: [{ blocks }], ...extra });

    it("seeds every bar in the document", () => {
      const seeded = withProgressPreviewStatus(
        { custom: {} },
        design([
          rowWith([{ type: "heading", data: { text: "Hi" } }, bar()]),
          rowWith([bar({ statusVariable: "custom.refund.status", steps: [{ label: "A", value: "requested", previewState: "active" }] })]),
        ]),
      );
      expect(seeded.custom).toEqual({
        shipment: { status: "out_for_delivery" },
        refund: { status: "requested" },
      });
    });

    it("returns the same object when nothing is missing", () => {
      const data = { custom: { shipment: { status: "shipped" } } };
      expect(withProgressPreviewStatus(data, design([rowWith([bar()])]))).toBe(data);
    });

    it("skips a bar that reads its status from the loop's item", () => {
      const data = { custom: {} };
      const looped = rowWith([bar({ statusVariable: "item.status" })], { loop: { variable: "custom.items", alias: "item" } });
      expect(withProgressPreviewStatus(data, design([looped]))).toBe(data);
    });

    it("still seeds a bar in a looped row whose path does not use the alias", () => {
      const looped = rowWith([bar()], { loop: { variable: "custom.items", alias: "item" } });
      const seeded = withProgressPreviewStatus({ custom: {} }, design([looped]));
      expect(seeded.custom).toEqual({ shipment: { status: "out_for_delivery" } });
    });
  });
});
