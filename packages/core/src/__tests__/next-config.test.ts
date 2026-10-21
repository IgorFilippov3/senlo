import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SENLO_TRANSPILE_PACKAGES, withSenlo } from "../../next.cjs";

const packagesDir = path.resolve(__dirname, "../../..");

describe("SENLO_TRANSPILE_PACKAGES", () => {
  it("lists every package in packages/", () => {
    const names = readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(packagesDir, entry.name, "package.json"))
      .map((file) => JSON.parse(readFileSync(file, "utf8")).name as string)
      .sort();

    expect([...SENLO_TRANSPILE_PACKAGES].sort()).toEqual(names);
  });
});

describe("withSenlo", () => {
  it("adds the packages and keeps the app's own, without duplicates", () => {
    const config = withSenlo({ transpilePackages: ["some-lib", "@senlo/ui"], reactStrictMode: true });

    expect(config.reactStrictMode).toBe(true);
    expect(config.transpilePackages).toContain("some-lib");
    expect(config.transpilePackages.filter((name) => name === "@senlo/ui")).toHaveLength(1);
    for (const name of SENLO_TRANSPILE_PACKAGES) {
      expect(config.transpilePackages).toContain(name);
    }
  });

  it("works without a config", () => {
    expect(withSenlo().transpilePackages).toEqual([...SENLO_TRANSPILE_PACKAGES]);
  });
});
