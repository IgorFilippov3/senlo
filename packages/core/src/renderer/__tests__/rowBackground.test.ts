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
    expect(rulesOf(html)).toEqual([
      ".senlo-bg-h2t3m5 { background-image: linear-gradient(180deg, #fdfdff, #e3e6fa) !important; }",
    ]);
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

describe("the MJML export", () => {
  it("carries the gradient as a class beside the colour", () => {
    const mjml = renderEmailDesignMJML(
      doc({ backgroundColor: "#eef0fb", backgroundGradient: GRADIENT }) as any,
    );

    expect(mjml).toContain('background-color="#eef0fb"');
    expect(mjml).toContain('css-class="senlo-bg-h2t3m5"');
    expect(mjml).toContain(
      ".senlo-bg-h2t3m5 { background-image: linear-gradient(180deg, #fdfdff, #e3e6fa) !important; }",
    );
  });

  it("takes the first stop as the section's colour when the row has none", () => {
    const mjml = renderEmailDesignMJML(
      doc({ backgroundGradient: GRADIENT }) as any,
    );

    expect(mjml).toContain('background-color="#fdfdff"');
  });

  it("adds nothing to a document without gradients", () => {
    const mjml = renderEmailDesignMJML(doc({ backgroundColor: "#eef0fb" }) as any);

    expect(mjml).not.toContain("css-class");
    expect(mjml).not.toContain("senlo-bg-");
  });
});
