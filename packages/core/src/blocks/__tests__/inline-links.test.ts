// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ContentBlockType } from "../../emailDesign";
import type { RenderContext } from "../../renderer/types";
import { resolveGlobals } from "../../renderer/types";
import { colorInlineLinks } from "../../renderer/utils";
import { getBlockDefinition } from "../registry";

/**
 * A text field holds raw HTML on purpose, so an author can write a link in the
 * middle of a sentence. A bare anchor is coloured by the mail client, which is
 * how a paragraph set to grey ends up with a bright blue "terms" in it.
 */
const LINK = '<a href="https://senlo.io/terms">terms</a>';

const context: RenderContext = {
  responsiveStyles: [],
  globals: resolveGlobals({ textColor: "#6b7280" }),
};

function render(type: ContentBlockType, data: Record<string, any>): string {
  return getBlockDefinition(type)!.renderHTML({ id: "b1", type, data }, context);
}

function renderMJML(type: ContentBlockType, data: Record<string, any>): string {
  return getBlockDefinition(type)!.renderMJML({ id: "b1", type, data }, undefined);
}

describe("colorInlineLinks", () => {
  it("writes the colour onto an anchor that has no style", () => {
    expect(colorInlineLinks(LINK, "#111827")).toBe(
      '<a style="color: #111827" href="https://senlo.io/terms">terms</a>',
    );
  });

  it("keeps the underline", () => {
    // A link the colour of the text around it and with nothing else marking it
    // is a link nobody clicks.
    expect(colorInlineLinks(LINK, "#111827")).not.toContain("text-decoration");
  });

  it("merges into a style the author already wrote", () => {
    const html = '<a href="#" style="font-weight: bold">x</a>';

    expect(colorInlineLinks(html, "#111827")).toContain(
      'style="font-weight: bold; color: #111827"',
    );
  });

  it("leaves an anchor whose author chose a colour alone", () => {
    const html = '<a href="#" style="color: #ff0000">x</a>';

    expect(colorInlineLinks(html, "#111827")).toBe(html);
  });

  it("is not fooled by background-color", () => {
    const html = '<a href="#" style="background-color: #eeeeee">x</a>';

    expect(colorInlineLinks(html, "#111827")).toContain(
      "background-color: #eeeeee; color: #111827",
    );
  });

  it("colours every link in the text, not just the first", () => {
    const html = `${LINK} and ${LINK}`;
    const out = colorInlineLinks(html, "#111827");

    expect(out.match(/color: #111827/g)).toHaveLength(2);
  });

  it("leaves tags that merely start with an a alone", () => {
    const html = '<abbr title="t">SLA</abbr><address>x</address>';

    expect(colorInlineLinks(html, "#111827")).toBe(html);
  });

  it("does nothing when the block has no colour to give", () => {
    // `inherit` is the fallback when neither the block nor the document names
    // one. Writing it onto the anchor is the unreliable half of the problem.
    expect(colorInlineLinks(LINK, "inherit")).toBe(LINK);
    expect(colorInlineLinks(LINK, undefined)).toBe(LINK);
  });

  it("cannot be used to break out of the style attribute", () => {
    const out = colorInlineLinks(LINK, '#fff" onmouseover="alert(1)');

    expect(out).not.toContain('onmouseover="');
    expect(out).toContain("&quot;");
  });

  it("returns text with no links untouched", () => {
    expect(colorInlineLinks("Plain <strong>copy</strong>", "#111827")).toBe(
      "Plain <strong>copy</strong>",
    );
  });
});

describe("a link inside a block's text", () => {
  it("takes the paragraph's own colour", () => {
    const html = render("paragraph", {
      text: `Read the ${LINK}.`,
      color: "#334155",
    });

    expect(html).toContain('<a style="color: #334155"');
  });

  it("falls back to the document's text colour", () => {
    const html = render("paragraph", { text: `Read the ${LINK}.` });

    expect(html).toContain('<a style="color: #6b7280"');
  });

  it("takes the heading's colour", () => {
    const html = render("heading", { text: `A ${LINK}`, color: "#0f172a" });

    expect(html).toContain('<a style="color: #0f172a"');
  });

  it("takes the list's colour, in every item", () => {
    const html = render("list", {
      items: [`One ${LINK}`, `Two ${LINK}`],
      listType: "unordered",
      color: "#334155",
    });

    expect(html.match(/<a style="color: #334155"/g)).toHaveLength(2);
  });

  it("takes the colour of the product line column it sits in", () => {
    const html = render("product-line", {
      items: [{ left: `Device ${LINK}`, right: `Chrome ${LINK}` }],
      leftStyle: { color: "#334155" },
      rightStyle: { color: "#94a3b8" },
    });

    expect(html).toContain('<a style="color: #334155"');
    expect(html).toContain('<a style="color: #94a3b8"');
  });

  it("reaches the MJML export too", () => {
    const mjml = renderMJML("paragraph", {
      text: `Read the ${LINK}.`,
      color: "#334155",
    });

    expect(mjml).toContain('<a style="color: #334155"');
  });

  it("does not disturb a block whose whole text is the link", () => {
    // `href` on the block wraps the text in an anchor of its own. That one is
    // written by the renderer with `color: inherit` already on it, so the
    // helper has nothing to add and must not add anything.
    const html = render("paragraph", {
      text: "Track it",
      href: "https://senlo.io/track",
      color: "#334155",
    });

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("color: inherit");
  });
});
