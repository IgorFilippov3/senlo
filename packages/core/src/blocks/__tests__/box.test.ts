// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ContentBlockType } from "../../emailDesign";
import type { RenderContext } from "../../renderer/types";
import { getBlockDefinition } from "../registry";

/**
 * The blocks that carry the shared box fields: a background, a border, rounded
 * corners and an outer gap.
 */
const BOXED_TYPES: ContentBlockType[] = [
  "heading",
  "paragraph",
  "list",
  "product-line",
  "socials",
];

/** Content that satisfies each type's schema, so only the box differs. */
const CONTENT: Record<string, any> = {
  heading: { text: "Title" },
  paragraph: { text: "Body" },
  list: { items: ["One"], listType: "unordered" },
  "product-line": { leftText: "Device", rightText: "Chrome macOS" },
  socials: { links: [{ type: "github", url: "https://a.b", icon: "/i.png" }] },
};

const context: RenderContext = { responsiveStyles: [] };

function render(type: ContentBlockType, data: Record<string, any>): string {
  const definition = getBlockDefinition(type)!;
  return definition.renderHTML({ id: "b1", type, data }, context);
}

function renderMJML(type: ContentBlockType, data: Record<string, any>): string {
  const definition = getBlockDefinition(type)!;
  return definition.renderMJML({ id: "b1", type, data }, undefined);
}

/** The wrapper cell the box adds, and nothing else in the codebase, uses this. */
const WRAPPER = "border-collapse: separate";

describe("a block with no box styling", () => {
  it.each(BOXED_TYPES)("renders %s exactly as before", (type) => {
    const html = render(type, CONTENT[type]);

    expect(html).not.toContain(WRAPPER);
  });

  it.each(BOXED_TYPES)("leaves %s alone when the fields are empty", (type) => {
    const html = render(type, {
      ...CONTENT[type],
      border: { width: 0 },
      borderRadius: 0,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    expect(html).not.toContain(WRAPPER);
  });
});

describe("background", () => {
  it.each(BOXED_TYPES)("wraps %s in a cell that paints it", (type) => {
    const html = render(type, {
      ...CONTENT[type],
      backgroundColor: "#fffbeb",
    });

    expect(html).toContain(WRAPPER);
    expect(html).toContain("background-color: #fffbeb");
  });

  it("keeps the block's own padding inside the background", () => {
    const html = render("paragraph", {
      text: "Body",
      padding: { top: 20, right: 24, bottom: 20, left: 24 },
      backgroundColor: "#fffbeb",
    });

    const cellStart = html.indexOf("background-color: #fffbeb");
    const paragraphStart = html.indexOf("<p ");

    expect(cellStart).toBeGreaterThan(-1);
    expect(paragraphStart).toBeGreaterThan(cellStart);
    expect(html).toContain("padding: 20px 24px 20px 24px");
  });
});

describe("border", () => {
  it("writes one declaration for a border of equal width", () => {
    const html = render("paragraph", {
      text: "Body",
      border: { width: 1, style: "solid", color: "#e5e7eb" },
    });

    expect(html).toContain("border: 1px solid #e5e7eb");
  });

  it("writes the sides that have a width of their own", () => {
    const html = render("paragraph", {
      text: "Body",
      border: { left: 3, style: "solid", color: "#d97706" },
    });

    expect(html).toContain("border-left: 3px solid #d97706");
    expect(html).not.toContain("border-right");
  });

  it("falls back to a solid black border", () => {
    const html = render("paragraph", { text: "Body", border: { width: 2 } });

    expect(html).toContain("border: 2px solid #000000");
  });

  it("rounds the corners", () => {
    const html = render("paragraph", {
      text: "Body",
      border: { width: 1, color: "#e5e7eb" },
      borderRadius: 12,
    });

    expect(html).toContain("border-radius: 12px");
  });
});

describe("the outer gap", () => {
  it("is a cell of its own, so the background stays out of it", () => {
    const html = render("paragraph", {
      text: "Body",
      backgroundColor: "#fffbeb",
      margin: { top: 16, right: 0, bottom: 16, left: 0 },
    });

    const gap = html.indexOf("padding: 16px 0px 16px 0px");
    const background = html.indexOf("background-color: #fffbeb");

    expect(gap).toBeGreaterThan(-1);
    expect(background).toBeGreaterThan(gap);
  });

  it("needs no background to work", () => {
    const html = render("paragraph", {
      text: "Body",
      margin: { top: 24, right: 0, bottom: 0, left: 0 },
    });

    expect(html).toContain("padding: 24px 0px 0px 0px");
    expect(html).not.toContain("background-color");
  });
});

describe("hostile values", () => {
  it("cannot break out of the style attribute", () => {
    const html = render("paragraph", {
      text: "Body",
      backgroundColor: '#fff" onmouseover="alert(1)',
    });

    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain("&quot;");
  });
});

describe("the MJML export", () => {
  it("moves the gap to the component and the card inside it", () => {
    const mjml = renderMJML("paragraph", {
      text: "Body",
      padding: { top: 20, right: 24, bottom: 20, left: 24 },
      margin: { top: 16, right: 0, bottom: 16, left: 0 },
      backgroundColor: "#fffbeb",
      border: { width: 1, color: "#fde68a" },
      borderRadius: 8,
    });

    expect(mjml).toContain('padding="16px 0px 16px 0px"');
    expect(mjml).toContain("padding: 20px 24px 20px 24px");
    expect(mjml).toContain("background-color: #fffbeb");
    expect(mjml).toContain("border: 1px solid #fde68a");
    expect(mjml).toContain("border-radius: 8px");
  });

  it("adds the gap to the padding when there is no card to draw", () => {
    const mjml = renderMJML("paragraph", {
      text: "Body",
      padding: { top: 10, right: 0, bottom: 10, left: 0 },
      margin: { top: 6, right: 0, bottom: 6, left: 0 },
    });

    expect(mjml).toContain('padding="16px 0px 16px 0px"');
  });

  it("carries the background of a socials block, which cannot be wrapped", () => {
    const mjml = renderMJML("socials", {
      ...CONTENT.socials,
      backgroundColor: "#f3f4f6",
    });

    expect(mjml).toContain('container-background-color="#f3f4f6"');
  });
});
