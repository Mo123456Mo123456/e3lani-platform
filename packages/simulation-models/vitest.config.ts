import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@kawkab/shared-types": new URL(
        "../shared-types/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
