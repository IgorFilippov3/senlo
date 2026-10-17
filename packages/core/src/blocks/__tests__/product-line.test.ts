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

describe("alignment", () => {
  it("keeps the label left and the value right by default", () => {
    const html = render(threeLines);

    expect(html).toContain('align="left"');
    expect(html).toContain('align="right"');
    expect(html).toContain("text-align: left");
    expect(html).toContain("text-align: right");
    expect(html).toContain("vertical-align: top");
    expect(html).not.toContain("text-align: center");
  });

  it("aligns each column on its own", () => {
    const html = render({ ...threeLines, leftAlign: "center", rightAlign: "left" });

    // One cell of each column per line.
    expect(html.match(/align="center"/g)).toHaveLength(3);
    expect(html.match(/text-align: center/g)).toHaveLength(3);
    expect(html.match(/text-align: left/g)).toHaveLength(3);
    expect(html).not.toContain("text-align: right");
  });

  it("sits both cells of a line at the same height", () => {
    const html = render({ ...threeLines, verticalAlign: "middle" });

    expect(html.match(/valign="middle"/g)).toHaveLength(6);
    expect(html.match(/vertical-align: middle/g)).toHaveLength(6);
    expect(html).not.toContain("vertical-align: top");
  });

  it("is carried into the MJML export", () => {
    const mjml = renderMJML({
      ...threeLines,
      leftAlign: "right",
      rightAlign: "center",
      verticalAlign: "bottom",
    });

    expect(mjml.match(/align="right"/g)).toHaveLength(3);
    expect(mjml.match(/align="center"/g)).toHaveLength(3);
    expect(mjml.match(/valign="bottom"/g)).toHaveLength(6);
    expect(mjml).not.toContain('align="left"');
  });
});

describe("on a phone", () => {
  const longValues = {
    items: [
      { left: "Ship to", right: "Amelia Hart, Bulevar Oslobođenja 12, 21000 Novi Sad, Serbia" },
      { left: "Total", right: "$1,299.00" },
    ],
  };

  const renderIn = (contentWidth = 600) => {
    const ctx: RenderContext = {
      responsiveStyles: [],
      globals: { fontFamily: "Arial", contentWidth },
    };
    const html = definition.renderHTML({ id: "b1", type: "product-line", data: longValues }, ctx);
    return { html, styles: ctx.responsiveStyles.join("\n") };
  };

  it("keeps the value on one line at full width, as it always has", () => {
    const { html } = renderIn();
    expect(html.match(/white-space: nowrap/g)).toHaveLength(2);
    expect(html).toContain("width: 120px");
  });

  it("lets the value wrap and drop its fixed width below the document's width", () => {
    const { html, styles } = renderIn(600);
    const cls = html.match(/<td class="(senlo-pl-[^"]+)"/)?.[1];

    expect(cls).toBeTruthy();
    expect(styles).toContain("@media only screen and (max-width: 600px)");
    expect(styles).toContain(`.${cls} {`);
    expect(styles).toContain("white-space: normal !important");
    expect(styles).toContain("width: auto !important");
    expect(styles).toContain("word-break: break-word !important");
  });

  it("puts the class on the value cells only", () => {
    const { html } = renderIn();
    expect(html.match(/<td class="senlo-pl-/g)).toHaveLength(2);
    expect(html.match(/<td /g)).toHaveLength(4);
  });

  it("follows the document's width", () => {
    expect(renderIn(520).styles).toContain("max-width: 520px");
  });

  it("registers the rule once however many blocks there are", () => {
    const ctx: RenderContext = { responsiveStyles: [], globals: { fontFamily: "Arial", contentWidth: 600 } };
    definition.renderHTML({ id: "a", type: "product-line", data: longValues }, ctx);
    definition.renderHTML({ id: "b", type: "product-line", data: threeLines }, ctx);
    expect(ctx.responsiveStyles.filter((rule) => rule.includes("senlo-pl-"))).toHaveLength(1);
  });
});
