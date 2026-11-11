import { defineConfig } from "vitest/config";

// The builder's logic apart from React (rule editing, card summaries).
// Components are checked by hand for now; a DOM test setup comes when a
// screen needs it.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
