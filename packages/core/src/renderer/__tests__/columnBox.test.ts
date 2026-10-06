// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { columnBlockSchema, type ColumnSettings } from "../../emailDesign";
import { renderEmailDesign } from "../renderEmailDesign";
import { renderEmailDesignMJML } from "../renderMJML";
import { mjmlColumnAttributes, renderColumnBox } from "../utils";

const doc = (settings?: ColumnSettings) => ({
  version: 4,
  settings: { contentWidth: 600, backgroundColor: "#ffffff" },
  rows: [
    {
      id: "r",
      type: "row" as const,
      settings: {},
      columns: [
        {
          id: "c",
          width: 100,
          blocks: [{ id: "p", type: "paragraph" as const, data: { text: "48,213" } }],
          ...(settings ? { settings } : {}),
        },
      ],
    },
  ],
});

const CARD: ColumnSettings = {
  backgroundColor: "#f8f8fc",
  border: { width: 1, style: "solid", color: "#e4e4f0" },
  borderRadius: 10,
  padding: { top: 14, right: 16, bottom: 14, left: 16 },
  margin: { top: 0, right: 6, bottom: 12, left: 6 },
};

describe("renderColumnBox", () => {
  it("leaves a column with nothing set untouched", () => {
    expect(renderColumnBox("<p>x</p>")).toBe("<p>x</p>");
    expect(renderColumnBox("<p>x</p>", {})).toBe("<p>x</p>");
  });

  it("renders exactly as before for a column saved without settings", () => {
    expect(renderEmailDesign(doc() as any)).toBe(renderEmailDesign(doc({}) as any));
  });

  it("puts the padding inside the card and the margin outside it", () => {
    const html = renderColumnBox("<p>x</p>", CARD);

    const outer = html.indexOf("padding: 0px 6px 12px 6px");
    const card = html.indexOf("background-color: #f8f8fc");
    const content = html.indexOf("<p>x</p>");

    expect(outer).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(outer);
    expect(content).toBeGreaterThan(card);
    expect(html).toContain("border: 1px solid #e4e4f0");
    expect(html).toContain("border-radius: 10px");
    expect(html).toContain("padding: 14px 16px 14px 16px");
  });

  it("folds padding and margin into one cell when there is no card", () => {
    const html = renderColumnBox("<p>x</p>", {
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
      margin: { top: 0, right: 6, bottom: 0, left: 6 },
    });

    expect(html).toContain("padding: 4px 10px 4px 10px");
    expect(html.match(/<td/g)).toHaveLength(1);
  });

  it("reaches the sent message", () => {
    const html = renderEmailDesign(doc(CARD) as any);
    expect(html).toContain("background-color: #f8f8fc");
    expect(html).toContain("48,213");
  });
});

describe("mjmlColumnAttributes", () => {
  it("adds nothing for a column with nothing set", () => {
    expect(mjmlColumnAttributes()).toBe("");
    expect(renderEmailDesignMJML(doc() as any)).toBe(renderEmailDesignMJML(doc({}) as any));
  });

  it("styles the column itself when there is no gap, so padding is the inner space", () => {
    const attrs = mjmlColumnAttributes({ ...CARD, margin: undefined });
    expect(attrs).toContain('background-color="#f8f8fc"');
    expect(attrs).toContain('border="1px solid #e4e4f0"');
    expect(attrs).toContain('border-radius="10px"');
    expect(attrs).toContain('padding="14px 16px 14px 16px"');
    expect(attrs).not.toContain("inner-");
  });

  it("moves the card inside when there is a gap", () => {
    const attrs = mjmlColumnAttributes(CARD);
    expect(attrs).toContain('inner-background-color="#f8f8fc"');
    expect(attrs).toContain('inner-border="1px solid #e4e4f0"');
    expect(attrs).toContain('inner-border-radius="10px"');
    expect(attrs).toContain('padding="0px 6px 12px 6px"');
  });

  it("keeps per-side borders per side", () => {
    const attrs = mjmlColumnAttributes({ border: { top: 2, style: "dashed", color: "#000" } });
    expect(attrs).toContain('border-top="2px dashed #000"');
  });
});

describe("columnBlockSchema", () => {
  it("takes a column without settings and does not add any", () => {
    const parsed = columnBlockSchema.parse({ id: "c", width: 100, blocks: [] });
    expect(parsed).not.toHaveProperty("settings");
  });

  it("takes a styled column", () => {
    expect(columnBlockSchema.safeParse({ id: "c", width: 50, blocks: [], settings: CARD }).success).toBe(true);
  });
});
