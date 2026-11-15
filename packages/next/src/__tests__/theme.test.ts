// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/*
 * @senlo/ui's tokens, read as text: the warm theme on `:root` and the classic
 * one that `EditorScreen` switches on for the template editor.
 */
const css = readFileSync(createRequire(import.meta.url).resolve("@senlo/ui/styles.css"), "utf8");

/** The declarations of the first rule with this selector (the file has no nested rules). */
function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `no "${selector}" rule`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start)).replace(/\/\*[\s\S]*?\*\//g, "");
  const result = new Map<string, string>();
  for (const match of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) result.set(match[1], match[2].trim());
  return result;
}

const warm = declarations(":root");
const classic = declarations(":root:has(.sl-theme-classic)");

/** Tokens that carry the look; sizes, spacing, radii and z-indexes are the same in both themes. */
const isLook = (name: string) => /^--(sl-color|sl-shadow|color)-/.test(name) || /^--sl-font-(sans|mono)$/.test(name);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function hex(token: string): string {
  const value = warm.get(token);
  expect(value, `${token} is a hex colour`).toMatch(/^#[0-9a-f]{6}$/);
  return value as string;
}

describe("@senlo/ui theme tokens", () => {
  it("the classic theme restates every colour, shadow and font of the warm one", () => {
    const missing = [...warm.keys()].filter((name) => isLook(name) && !classic.has(name));
    expect(missing).toEqual([]);
  });

  it("the classic theme sets nothing the warm one does not know, except the hosts' two variables", () => {
    const extra = [...classic.keys()].filter((name) => !warm.has(name));
    expect(extra.sort()).toEqual(["--background", "--foreground"]);
  });

  it("the classic theme is the old look: blue primary, Tailwind's own neutrals", () => {
    expect(classic.get("--sl-color-primary")).toBe("#2563eb");
    expect(classic.get("--sl-color-bg-page")).toBe("#ffffff");
    expect(classic.get("--color-zinc-500")).toMatch(/^oklch\(/);
    expect(classic.get("--sl-font-sans")).toContain("Arial");
  });

  it.each([
    ["--sl-color-text", "--sl-color-bg-page"],
    ["--sl-color-text-secondary", "--sl-color-bg-page"],
    ["--sl-color-text-muted", "--sl-color-bg-page"],
    ["--sl-color-text-secondary", "--sl-color-bg-accent"],
    ["--sl-color-text-muted", "--sl-color-bg-muted"],
    ["--sl-color-primary-foreground", "--sl-color-primary-light"],
    ["--sl-color-primary-foreground", "--sl-color-primary"],
    ["--sl-color-bg-subtle", "--sl-color-text-primary"],
    ["--sl-color-destructive-foreground", "--sl-color-destructive"],
    ["--sl-color-destructive-text", "--sl-color-destructive-bg"],
    ["--sl-color-success-text", "--sl-color-success-bg"],
    ["--sl-color-warning-text", "--sl-color-warning-bg"],
    ["--sl-color-accent", "--sl-color-bg-page"],
    ["--sl-color-accent-foreground", "--sl-color-accent"],
    ["--color-zinc-500", "--color-zinc-100"],
    ["--color-zinc-600", "--color-zinc-50"],
    ["--color-red-600", "--color-red-50"],
    ["--color-amber-600", "--color-amber-50"],
    ["--color-amber-800", "--color-amber-50"],
    ["--color-amber-700", "--color-amber-100"],
  ])("%s on %s is readable (4.5:1)", (foreground, background) => {
    expect(contrast(hex(foreground), hex(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("errors are told apart from the accent: crimson, not terracotta", () => {
    expect(hex("--sl-color-destructive")).not.toBe(hex("--sl-color-accent"));
    expect(hex("--color-red-600")).toBe(hex("--sl-color-destructive"));
    expect(hex("--color-rose-600")).toBe(hex("--sl-color-destructive"));
  });

  it("a warning stands out from the page: its ground is clearly yellow, its border visible", () => {
    // Tailwind's amber-50 (#fffbeb) against the warm page is about 1.01:1, i.e. invisible.
    expect(contrast(hex("--color-amber-200"), hex("--sl-color-bg-page"))).toBeGreaterThanOrEqual(1.5);
    expect(hex("--sl-color-warning-bg")).toBe(hex("--color-amber-50"));
  });

  it("the screens' neutral scales are one warm scale", () => {
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect(warm.get(`--color-gray-${step}`)).toBe(warm.get(`--color-zinc-${step}`));
    }
    expect(hex("--color-zinc-200")).toBe(hex("--sl-color-border"));
  });
});
