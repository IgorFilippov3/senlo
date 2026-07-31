import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  external: ["react", "react-dom"],
  injectStyle: false, // We want a separate CSS file
  // Ensure we extract CSS to a single file
  onSuccess: async () => {
    // We could do something here if needed
  },
});
