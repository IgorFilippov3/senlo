import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Each test file pushes the schema into a fresh in-memory Postgres.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
