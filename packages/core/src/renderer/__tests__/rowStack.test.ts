// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { rowBlockSchema } from "../../emailDesign";
import { renderEmailDesign } from "../renderEmailDesign";
import { renderEmailDesignMJML } from "../renderMJML";

const column = (id: string, width: number, text: string) => ({
  id,
  width,
  blocks: [{ id: `p-${id}`, type: "paragraph" as const, data: { text } }],
});

const doc = (settings: Record<string, unknown>, columns = [column("a", 20, "Thumb"), column("b", 80, "Linen overshirt")]) => ({
  version: 4,
  settings: { contentWidth: 600 },
  rows: [{ id: "r", type: "row" as const, settings, columns }],
});

/** Column wrappers in the body, not the rule in the head that styles them. */
const stackedColumns = (html: string) =>
  (html.match(/<div class="senlo-stack"/g) || []).length;

const columnDivs = (html: string) =>
  (html.match(/<div(?: class="senlo-stack")? style="display: inline-block;/g) || []).length;

describe("stacking columns on a phone", () => {
  it("stacks by default, as every row did before the setting existed", () => {
    const html = renderEmailDesign(doc({}));
    expect(stackedColumns(html)).toBe(2);
  });

  it("stacks when the setting is on", () => {
    expect(stackedColumns(renderEmailDesign(doc({ stackOnMobile: true })))).toBe(2);
  });

  it("keeps the columns side by side when it is off", () => {
    const html = renderEmailDesign(doc({ stackOnMobile: false }));

    expect(stackedColumns(html)).toBe(0);
    // Still two inline-block columns with their own share of the width.
    expect(columnDivs(html)).toBe(2);
    expect(html).toContain("max-width: 20%");
    expect(html).toContain("max-width: 80%");
    expect(html).toContain("Linen overshirt");
  });

  it("leaves the Outlook table alone either way", () => {
    const on = renderEmailDesign(doc({}));
    const off = renderEmailDesign(doc({ stackOnMobile: false }));
    const msoCells = (html: string) => (html.match(/<td width="\d+%" valign="top"/g) || []).length;

    expect(msoCells(off)).toBe(msoCells(on));
  });

  it("only affects its own row", () => {
    const design = {
      version: 4,
      settings: { contentWidth: 600 },
      rows: [
        { id: "r1", type: "row" as const, settings: { stackOnMobile: false }, columns: [column("a", 50, "A"), column("b", 50, "B")] },
        { id: "r2", type: "row" as const, settings: {}, columns: [column("c", 50, "C"), column("d", 50, "D")] },
      ],
    };
    expect(stackedColumns(renderEmailDesign(design))).toBe(2);
  });

  it("is accepted by the document schema", () => {
    const parsed = rowBlockSchema.safeParse(doc({ stackOnMobile: false }).rows[0]);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.settings.stackOnMobile).toBe(false);
  });

  it("is not required by the document schema", () => {
    const parsed = rowBlockSchema.safeParse(doc({}).rows[0]);
    expect(parsed.success && parsed.data.settings.stackOnMobile).toBeUndefined();
  });
});

describe("stacking in the MJML export", () => {
  it("groups the columns when they are to stay side by side", () => {
    const mjml = renderEmailDesignMJML(doc({ stackOnMobile: false }));
    expect(mjml).toMatch(/<mj-group>\s*<mj-column width="20%"/);
  });

  it("adds no group to a row that stacks", () => {
    expect(renderEmailDesignMJML(doc({}))).not.toContain("<mj-group>");
  });

  it("adds no group to a single column, which has nothing to stack", () => {
    const mjml = renderEmailDesignMJML(doc({ stackOnMobile: false }, [column("a", 100, "Only")]));
    expect(mjml).not.toContain("<mj-group>");
  });
});
