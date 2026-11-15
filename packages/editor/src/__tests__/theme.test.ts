import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("..", import.meta.url).pathname;

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(SRC, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(join(SRC, path)).isDirectory()) return files(path, ext);
    return ext.test(name) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(SRC, path), "utf8");

/*
 * The editor's chrome takes its colours from @senlo/ui's tokens. In the
 * workspace the interaction colour (selection, drop target, active option)
 * is the accent, set once on `.senlo-editor-root`.
 */
describe("the editor's theme", () => {
  it("the workspace repoints the interaction colour to the accent", () => {
    const css = read("styles.css");
    const root = css.slice(css.indexOf(".senlo-editor-root {"), css.indexOf("}", css.indexOf(".senlo-editor-root {")));
    expect(root).toContain("--sl-color-primary: var(--sl-color-accent);");
    expect(root).toContain("--sl-color-primary-hover: var(--sl-color-accent-hover);");
    expect(root).toContain("--sl-color-primary-foreground: var(--sl-color-accent-foreground);");
  });

  it("no stylesheet writes the old blue or purple in by hand", () => {
    const offenders = files(".", /\.css$/).filter((path) => /59,\s*130,\s*246|#2563eb|#3b82f6|#9333ea|#1d4ed8/i.test(read(path)));
    expect(offenders).toEqual([]);
  });

  it("no component uses Tailwind's blue, indigo or purple for chrome", () => {
    const offenders = files("components", /\.tsx$/).filter((path) => /\b(blue|indigo|purple|violet|sky)-\d{2,3}\b/.test(read(path)));
    expect(offenders).toEqual([]);
  });
});
