// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { cssColorSchema } from "../../blocks/shared";
import type { RowBlock } from "../../emailDesign";
import { renderEmailDesign } from "../renderEmailDesign";
import { renderEmailDesignMJML } from "../renderMJML";
import {
  linearGradientCss,
  registerRowBackground,
  rowBackground,
  rowBackgroundDeclarations,
  rowBorder,
  rowBorderDeclarations,
} from "../rowBackground";
import type { RenderContext } from "../types";

type RowSettings = RowBlock["settings"];

const GRADIENT = { from: "#fdfdff", to: "#e3e6fa" };

const doc = (settings: RowSettings, count = 1) => ({
  version: 4,
  settings: { contentWidth: 600, backgroundColor: "#ffffff" },
  rows: Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    type: "row" as const,
    settings,
    columns: [
      {
        id: `c${i}`,
        width: 100,
        blocks: [{ id: `h${i}`, type: "heading" as const, data: { text: "Hi" } }],
      },
    ],
  })),
});

const headOf = (html: string) => html.match(/<style>[\s\S]*?<\/style>/)![0];
const rulesOf = (html: string) =>
  headOf(html).match(/\.senlo-bg-[a-z0-9]+ \{[^}]*\}/g) ?? [];

describe("cssColorSchema", () => {
  it("takes the shapes a colour is actually written in", () => {
    for (const value of [
      "#fff",
      "#ffff",
      "#ffffff",
      "#ffffffaa",
      "rgb(1,2,3)",
      "rgba(1, 2, 3, 0.5)",
      "rgb(10%,20%,30%)",
      "white",
      "transparent",
    ]) {
      expect(cssColorSchema.safeParse(value).success, value).toBe(true);
    }
  });

  it("rejects anything that could carry a second declaration", () => {
    // This is the whole point of the schema. A style attribute is escaped with
    // `escapeAttr`, which does not touch `;`, so a colour that can hold one is
    // a way to write declarations nobody asked for.
    for (const value of [
      "red; background-image: url(javascript:alert(1))",
      "#fff;",
      "rgb(1,2,3);color:red",
      "url(x)",
      "expression(alert(1))",
      "#ff",
      "",
    ]) {
      expect(cssColorSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("linearGradientCss", () => {
  it("defaults to top-to-bottom", () => {
    expect(linearGradientCss(GRADIENT)).toBe(
      "linear-gradient(180deg, #fdfdff, #e3e6fa)",
    );
  });

  it("takes an angle", () => {
    expect(linearGradientCss({ ...GRADIENT, angle: 90 })).toBe(
      "linear-gradient(90deg, #fdfdff, #e3e6fa)",
    );
  });

  it("is nothing at all when a colour would not pass the schema", () => {
    expect(
      linearGradientCss({ from: "red; background: url(x)", to: "#000" } as any),
    ).toBeNull();
    expect(linearGradientCss({ from: "#000", to: "}" } as any)).toBeNull();
    expect(linearGradientCss(undefined)).toBeNull();
  });

  it("falls back to the default angle rather than writing a nonsense one", () => {
    const fallback = "linear-gradient(180deg, #fdfdff, #e3e6fa)";

    for (const angle of [NaN, -10, 400, "90deg", null, Infinity]) {
      expect(
        linearGradientCss({ ...GRADIENT, angle } as any),
        String(angle),
      ).toBe(fallback);
    }
  });

  it("keeps an angle that is within range", () => {
    expect(linearGradientCss({ ...GRADIENT, angle: 0 })).toContain("0deg");
    expect(linearGradientCss({ ...GRADIENT, angle: 360 })).toContain("360deg");
    expect(linearGradientCss({ ...GRADIENT, angle: 135 })).toContain("135deg");
  });
});

describe("rowBackground", () => {
  it("is the row's own colour when there is no gradient", () => {
    expect(rowBackground({ backgroundColor: "#eef0fb" })).toEqual({
      backgroundColor: "#eef0fb",
    });
  });

  it("is transparent for a row with nothing set, exactly as it always was", () => {
    expect(rowBackground({})).toEqual({ backgroundColor: "transparent" });
    expect(rowBackground(undefined)).toEqual({ backgroundColor: "transparent" });
  });

  it("passes a colour through even when the schema would not take it", () => {
    // Colours have been written into the style attribute unvalidated since
    // before this module existed. Rejecting one here would change how a stored
    // document renders, which is a separate decision from adding a gradient.
    expect(rowBackground({ backgroundColor: "hsl(210 40% 96%)" })).toEqual({
      backgroundColor: "hsl(210 40% 96%)",
    });
  });

  it("keeps the colour underneath the gradient", () => {
    expect(
      rowBackground({ backgroundColor: "#eef0fb", backgroundGradient: GRADIENT }),
    ).toEqual({
      backgroundColor: "#eef0fb",
      backgroundImage: "linear-gradient(180deg, #fdfdff, #e3e6fa)",
    });
  });

  it("takes the first stop when the row has no colour of its own", () => {
    // A transparent row with a gradient would show the document's background
    // through it in every client that does not do gradients, which is not a
    // fallback at all.
    for (const settings of [
      { backgroundGradient: GRADIENT },
      { backgroundColor: "transparent", backgroundGradient: GRADIENT },
      { backgroundColor: "", backgroundGradient: GRADIENT },
    ]) {
      expect(rowBackground(settings as RowSettings).backgroundColor).toBe(
        "#fdfdff",
      );
    }
  });

  it("writes the colour before the image", () => {
    // A client that drops the image has to be left with the colour.
    expect(
      rowBackgroundDeclarations({
        backgroundColor: "#eef0fb",
        backgroundGradient: GRADIENT,
      }),
    ).toEqual([
      "background-color: #eef0fb",
      "background-image: linear-gradient(180deg, #fdfdff, #e3e6fa)",
    ]);
  });
});

describe("registerRowBackground", () => {
  const context = (): RenderContext => ({ responsiveStyles: [] });

  it("names the class after the gradient, so the same one is written once", () => {
    const ctx = context();
    const a = registerRowBackground(ctx, "linear-gradient(180deg, #a, #b)");
    const b = registerRowBackground(ctx, "linear-gradient(180deg, #a, #b)");

    expect(a).toBe(b);
    expect(ctx.responsiveStyles).toHaveLength(1);
  });

  it("gives different gradients different classes", () => {
    const ctx = context();
    const a = registerRowBackground(ctx, "linear-gradient(180deg, #a, #b)");
    const b = registerRowBackground(ctx, "linear-gradient(0deg, #a, #b)");

    expect(a).not.toBe(b);
    expect(ctx.responsiveStyles).toHaveLength(2);
  });
});

describe("a row with a gradient, rendered", () => {
  it("carries it inline and in the stylesheet", () => {
    // Gmail on Android rewrites the inline declaration and reads the class
    // instead; every other client reads the inline one. Hence both.
    const html = renderEmailDesign(
      doc({ backgroundColor: "#eef0fb", backgroundGradient: GRADIENT }) as any,
    );

    expect(html).toContain(
      "background-color: #eef0fb; background-image: linear-gradient(180deg, #fdfdff, #e3e6fa)",
    );

    // The class name is a hash of the rule and is nobody's business but the
    // renderer's; what matters is that exactly one rule exists and that the
    // element points at it.
    const rules = rulesOf(html);
    expect(rules).toHaveLength(1);
    expect(rules.join("")).toContain(
      "background-image: linear-gradient(180deg, #fdfdff, #e3e6fa) !important;",
    );

    // The class name is a hash of the rule and is nobody's business but the
    // renderer's; what matters is that the element points at the rule.
    const named = /\.(senlo-bg-[a-z0-9]+)/.exec(rules.join(""))?.[1] ?? "";
    expect(named).not.toBe("");
    expect(html).toContain(`class="${named}"`);
  });

  it("puts the class on the one element that carries the background", () => {
    for (const fullWidth of [false, true]) {
      const html = renderEmailDesign(
        doc({
          fullWidth,
          backgroundColor: "#eef0fb",
          backgroundGradient: GRADIENT,
        }) as any,
      );

      const classed = html.match(/<td[^>]*senlo-bg-[^>]*>/g) ?? [];
      const painted = html.match(/<td[^>]*background-image[^>]*>/g) ?? [];

      expect(classed, `fullWidth=${fullWidth}`).toHaveLength(1);
      expect(painted).toEqual(classed);
    }
  });

  it("writes one rule for two rows that share a gradient", () => {
    const html = renderEmailDesign(
      doc({ backgroundColor: "#eef0fb", backgroundGradient: GRADIENT }, 3) as any,
    );

    expect(rulesOf(html)).toHaveLength(1);
    expect(html.match(/senlo-bg-[a-z0-9]+/g)).toHaveLength(4); // one rule, three rows
  });

  it("leaves no trace at all in a document without one", () => {
    const html = renderEmailDesign(doc({ backgroundColor: "#eef0fb" }) as any);

    expect(html).not.toContain("senlo-bg-");
    expect(html).not.toContain("background-image");
  });

  it("drops a gradient whose colours would not pass the schema", () => {
    const html = renderEmailDesign(
      doc({
        backgroundGradient: { from: "red; background: url(x)", to: "#000" },
      } as any) as any,
    );

    expect(html).not.toContain("senlo-bg-");
    expect(html).not.toContain("url(x)");
    expect(html).toContain("background-color: transparent");
  });
});

describe("the stylesheet reaches the head", () => {
  it("carries a rule the body collected", () => {
    // `renderHead` interpolates `responsiveStyles` when it is called, so this
    // only holds while the body is rendered first. It is the assertion that
    // keeps that ordering from being quietly reversed again.
    const html = renderEmailDesign(
      doc({ backgroundColor: "#eef0fb", backgroundGradient: GRADIENT }) as any,
    );

    expect(headOf(html)).toContain("senlo-bg-");
  });
});

describe("a looped row", () => {
  it("still reaches the stylesheet", () => {
    // A loop renders the row against `{...context, localData}`, which copies
    // the reference to `responsiveStyles` rather than the array - so a rule
    // registered inside an iteration lands in the same stylesheet. Worth
    // pinning: a spread that deep-copied would silently lose every gradient
    // inside a loop and only inside a loop.
    const html = renderEmailDesign(
      {
        version: 4,
        settings: { contentWidth: 600 },
        rows: [
          {
            id: "r",
            type: "row",
            loop: { variable: "custom.items", alias: "item" },
            settings: { backgroundColor: "#eef0fb", backgroundGradient: GRADIENT },
            columns: [
              {
                id: "c",
                width: 100,
                blocks: [{ id: "h", type: "heading", data: { text: "Hi" } }],
              },
            ],
          },
        ],
      } as any,
      { data: { custom: { items: [1, 2, 3] } } as any },
    );

    expect(rulesOf(html)).toHaveLength(1);
    expect(headOf(html)).toContain("senlo-bg-");
  });
});

describe("a row's rule", () => {
  it("draws only the edges that were asked for", () => {
    expect(rowBorder({ border: { bottom: 2 } })).toEqual({
      borderBottom: "2px solid #e5e7eb",
    });
    expect(rowBorder({ border: { top: 1 } })).toEqual({
      borderTop: "1px solid #e5e7eb",
    });
    expect(rowBorder({ border: { top: 1, bottom: 3 } })).toEqual({
      borderTop: "1px solid #e5e7eb",
      borderBottom: "3px solid #e5e7eb",
    });
  });

  it("draws nothing for an edge of zero", () => {
    // Not `0px solid`, which some clients round up into a line nobody asked for.
    expect(rowBorder({ border: { top: 0, bottom: 0 } })).toEqual({});
    expect(rowBorder({ border: {} })).toEqual({});
    expect(rowBorder({})).toEqual({});
    expect(rowBorder(undefined)).toEqual({});
  });

  it("takes the style and colour it was given", () => {
    expect(
      rowBorder({ border: { bottom: 1, style: "dashed", color: "#4a7c2f" } }),
    ).toEqual({ borderBottom: "1px dashed #4a7c2f" });
  });

  it("falls back rather than writing a colour the schema would not take", () => {
    expect(
      rowBorder({
        border: { bottom: 1, color: "red; background: url(x)" },
      } as any),
    ).toEqual({ borderBottom: "1px solid #e5e7eb" });
  });

  it("ignores a width that is not a usable number", () => {
    for (const bottom of [NaN, -2, null, "2px"]) {
      expect(rowBorder({ border: { bottom } } as any), String(bottom)).toEqual(
        {},
      );
    }
  });

  it("comes back as declarations for the element that carries the background", () => {
    expect(rowBorderDeclarations({ border: { top: 1, bottom: 2 } })).toEqual([
      "border-top: 1px solid #e5e7eb",
      "border-bottom: 2px solid #e5e7eb",
    ]);
    expect(rowBorderDeclarations({})).toEqual([]);
  });
});

describe("a row with a rule, rendered", () => {
  const withBorder = (settings: RowSettings) =>
    renderEmailDesign(doc(settings) as any);

  it("puts it on the row's own cell, beside the padding", () => {
    // Same cell as the padding, so the padding pushes the content away from the
    // rule and the rule marks the row's edge rather than the text's.
    const html = withBorder({
      backgroundColor: "#ffffff",
      padding: { top: 10, right: 0, bottom: 10, left: 0 },
      border: { bottom: 2, color: "#4a7c2f" },
    });

    const cell = html.match(/<td[^>]*border-bottom: 2px solid #4a7c2f[^>]*>/);
    expect(cell).not.toBeNull();
    expect(cell![0]).toContain("padding: 10px 0px 10px 0px");
  });

  it("goes on the band of a full-width row, and not on its content", () => {
    const html = withBorder({
      fullWidth: true,
      backgroundColor: "#eef0fb",
      border: { bottom: 2, color: "#4a7c2f" },
    });

    const carrying = html.match(/<td[^>]*border-bottom: 2px solid #4a7c2f[^>]*>/g);
    expect(carrying).toHaveLength(1);
    // The band is the element that also carries the background.
    expect(carrying![0]).toContain("background-color: #eef0fb");
  });

  it("sits inside the outer gap, not outside it", () => {
    // The gap separates this row from the next; the rule belongs to this row.
    const html = withBorder({
      backgroundColor: "#ffffff",
      margin: { top: 0, right: 0, bottom: 16, left: 0 },
      border: { bottom: 1 },
    });

    const gap = html.indexOf("padding: 0px 0px 16px 0px");
    const rule = html.indexOf("border-bottom: 1px solid");

    expect(gap).toBeGreaterThan(-1);
    expect(rule).toBeGreaterThan(gap);
  });

  it("leaves a row without one exactly as it was", () => {
    const html = withBorder({ backgroundColor: "#ffffff" });

    expect(html).not.toContain("border-top:");
    expect(html).not.toContain("border-bottom:");
  });
});

describe("the MJML export", () => {
  it("carries the gradient as a class beside the colour", () => {
    const mjml = renderEmailDesignMJML(
      doc({ backgroundColor: "#eef0fb", backgroundGradient: GRADIENT }) as any,
    );

    expect(mjml).toContain('background-color="#eef0fb"');

    const named = /\.(senlo-bg-[a-z0-9]+)/.exec(mjml)?.[1] ?? "";
    expect(named).not.toBe("");
    expect(mjml).toContain(`css-class="${named}"`);
    expect(mjml).toContain(
      `.${named} { background-image: linear-gradient(180deg, #fdfdff, #e3e6fa) !important; }`,
    );
  });

  it("takes the first stop as the section's colour when the row has none", () => {
    const mjml = renderEmailDesignMJML(
      doc({ backgroundGradient: GRADIENT }) as any,
    );

    expect(mjml).toContain('background-color="#fdfdff"');
  });

  it("carries the rule as section attributes", () => {
    const mjml = renderEmailDesignMJML(
      doc({ border: { top: 1, bottom: 2, color: "#4a7c2f" } }) as any,
    );

    expect(mjml).toContain('border-top="1px solid #4a7c2f"');
    expect(mjml).toContain('border-bottom="2px solid #4a7c2f"');
  });

  it("adds no border attributes to a row without a rule", () => {
    const mjml = renderEmailDesignMJML(doc({ backgroundColor: "#eef0fb" }) as any);

    expect(mjml).not.toContain("border-top=");
    expect(mjml).not.toContain("border-bottom=");
  });

  it("adds nothing to a document without gradients", () => {
    const mjml = renderEmailDesignMJML(doc({ backgroundColor: "#eef0fb" }) as any);

    expect(mjml).not.toContain("css-class");
    expect(mjml).not.toContain("senlo-bg-");
  });
});
