import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Next does not bundle the packages on its server-external list: it loads
 * them at runtime from the host app's own `node_modules`, not from the
 * package that depends on them. A dependency of `packages/*` on that list
 * must therefore be declared by the app too, or pages that reach it fail at
 * runtime ("Package X can't be external" at build). `pg` (6.2) and
 * `@aws-sdk/client-s3` (7.3) were both found by hand; this catches the next one.
 */
const repoRoot = path.resolve(__dirname, "../../../..");
const appDir = path.join(repoRoot, "apps/web");
const packagesDir = path.join(repoRoot, "packages");

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const serverExternals = new Set<string>(
  createRequire(path.join(appDir, "package.json"))("next/dist/lib/server-external-packages.json"),
);

describe("server externals", () => {
  it("every one the packages depend on is declared by apps/web, with the same range", () => {
    const app = readJson(path.join(appDir, "package.json"));
    const appDeps: Record<string, string> = app.dependencies ?? {};

    const problems: string[] = [];
    for (const dir of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const pkg = readJson(path.join(packagesDir, dir.name, "package.json"));
      const deps: Record<string, string> = { ...pkg.peerDependencies, ...pkg.dependencies };
      for (const [name, range] of Object.entries(deps)) {
        if (!serverExternals.has(name)) continue;
        if (!appDeps[name]) {
          problems.push(`${name} (from ${pkg.name}) is missing in apps/web dependencies; add "${name}": "${range}"`);
        } else if (appDeps[name] !== range) {
          problems.push(`${name}: ${pkg.name} wants "${range}", apps/web has "${appDeps[name]}"; use one range`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("reads Next's list", () => {
    // Guards the test itself: an empty or moved list would make it pass vacuously.
    expect(serverExternals.has("pg")).toBe(true);
  });
});
