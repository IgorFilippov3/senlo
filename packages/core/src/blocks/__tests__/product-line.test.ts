// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { RenderContext } from "../../renderer/types";
import { getBlockDefinition } from "../registry";
import { productLineItems } from "../product-line";

const definition = getBlockDefinition("product-line")!;
const context: RenderContext = { responsiveStyles: [] };

const render = (data: Record<string, any>) =>
  definition.renderHTML({ id: "b1", type: "product-line", data }, context);

const renderMJML = (data: Record<string, any>) =>
  definition.renderMJML({ id: "b1", type: "product-line", data }, undefined);

const threeLines = {
  items: [
    { left: "DEVICE", right: "Chrome macOS" },
    { left: "LOCATION", right: "San Francisco, US" },
    { left: "IP ADDRESS", right: "192.168.1.42" },
  ],
};

describe("the list", () => {
  it("renders one table row per line", () => {
    const html = render(threeLines);

    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toContain("DEVICE");
    expect(html).toContain("San Francisco, US");
    expect(html).toContain("192.168.1.42");
  });

  it("keeps the lines in order", () => {
    const html = render(threeLines);

    expect(html.indexOf("DEVICE")).toBeLessThan(html.indexOf("LOCATION"));
    expect(html.indexOf("LOCATION")).toBeLessThan(html.indexOf("IP ADDRESS"));
  });

  it("renders a single line without ceremony", () => {
    const html = render({ items: [{ left: "Mug", right: "$12.00" }] });

    expect(html.match(/<tr>/g)).toHaveLength(1);
  });

  it("names itself by its length once there is more than one line", () => {
    expect(definition.describe!({ type: "product-line", data: threeLines })).toBe(
      "Product Line: 3 lines",
    );
    expect(
      definition.describe!({
        type: "product-line",
        data: { items: [{ left: "Mug", right: "$12.00" }] },
      }),
    ).toBe("Product Line: Mug - $12.00");
  });

  it("starts as a list of one", () => {
    expect(definition.createDefaults().items).toHaveLength(1);
  });
});

describe("the rule between lines", () => {
  it("is absent unless asked for", () => {
    expect(render(threeLines)).not.toContain("border-bottom");
  });

  it("sits under every line but the last", () => {
    const html = render({
      ...threeLines,
      divider: { width: 1, style: "solid", color: "#e5e7eb" },
    });

    // Two rules for three lines, on both cells of each - four declarations.
    expect(html.match(/border-bottom: 1px solid #e5e7eb/g)).toHaveLength(4);
  });

  it("is dropped when its width is zero", () => {
    const html = render({ ...threeLines, divider: { width: 0 } });

    expect(html).not.toContain("border-bottom");
  });

  it("never appears under a single line", () => {
    const html = render({
      items: [{ left: "Mug", right: "$12.00" }],
      divider: { width: 1 },
    });

    expect(html).not.toContain("border-bottom");
  });
});

describe("the space inside a line", () => {
  it("is written on both cells", () => {
    const html = render({
      ...threeLines,
      rowPadding: { top: 14, right: 0, bottom: 14, left: 0 },
    });

    expect(html.match(/padding: 14px 0px 14px 0px/g)).toHaveLength(6);
  });

  it("is zero for a block that predates it", () => {
    const html = render(threeLines);

    expect(html).toContain("padding: 0px 0px 0px 0px");
  });
});

describe("productLineItems", () => {
  it("reads a block that never went through the migration", () => {
    expect(productLineItems({ leftText: "Mug", rightText: "$12.00" })).toEqual([
      { left: "Mug", right: "$12.00" },
    ]);
  });

  it("prefers the list when there is one", () => {
    expect(
      productLineItems({ items: [{ left: "A", right: "B" }], leftText: "old" }),
    ).toEqual([{ left: "A", right: "B" }]);
  });

  it("is empty for a block with neither", () => {
    expect(productLineItems({})).toEqual([]);
  });
});

describe("the MJML export", () => {
  it("carries every line and the rule", () => {
    const mjml = renderMJML({ ...threeLines, divider: { width: 1 } });

    expect(mjml.match(/<tr>/g)).toHaveLength(3);
    expect(mjml).toContain("LOCATION");
    expect(mjml.match(/border-bottom: 1px solid #e5e7eb/g)).toHaveLength(4);
  });
});
