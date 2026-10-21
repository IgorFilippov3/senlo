import { defineConfig } from "tsup";

export default defineConfig({
  // `api-docs` is its own entry so the Scalar renderer stays out of the root bundle.
  entry: { index: "src/index.ts", "api-docs": "src/api-docs/index.ts" },
  format: ["cjs", "esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  // Scalar stays external so its stylesheet import is resolved by the app's bundler.
  external: [
    "react",
    "react-dom",
    "@tanstack/react-query",
    "recharts",
    "date-fns",
    "@scalar/api-reference-react",
  ],
});
