// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorSkeleton, LoadingState, PageSkeleton, startsNavigation } from "@senlo/features";

const css = readFileSync(createRequire(import.meta.url).resolve("@senlo/ui/styles.css"), "utf8");

/*
 * Moving between sections must not flicker: a placeholder that shows for a
 * few frames and is replaced by the content is worse than no placeholder.
 */
describe("loading placeholders appear after a delay", () => {
  it("@senlo/ui defines the delay: invisible for 200 ms, then a short fade in", () => {
    const rule = css.slice(css.indexOf(".sl-delayed {"), css.indexOf("}", css.indexOf(".sl-delayed {")));
    expect(rule).toContain("animation: sl-appear 0.15s ease-out 0.2s both;");
    expect(css).toContain("@keyframes sl-appear");
  });

  it.each([
    ["PageSkeleton", () => createElement(PageSkeleton, { variant: "cards" })],
    ["LoadingState", () => createElement(LoadingState, {})],
  ])("%s is delayed", (_name, element) => {
    expect(renderToStaticMarkup(element())).toContain("sl-delayed");
  });

  it("the delay sits on a wrapper, not on the pulsing element: one element cannot run two animations", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton, { variant: "rows" }));
    expect(html).toMatch(/^<div class="sl-delayed"><main [^>]*animate-pulse/);
  });

  it("the editor's skeleton is not delayed: the editor always takes long enough to need it", () => {
    expect(renderToStaticMarkup(createElement(EditorSkeleton))).not.toContain("sl-delayed");
  });
});

describe("startsNavigation", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it("a plain left click navigates in this tab", () => {
    expect(startsNavigation(click)).toBe(true);
  });

  it.each([
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["the middle button", { button: 1 }],
  ])("a click with %s opens elsewhere and leaves this page where it is", (_name, change) => {
    expect(startsNavigation({ ...click, ...change })).toBe(false);
  });
});
