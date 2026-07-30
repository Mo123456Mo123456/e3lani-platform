import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@kawkab/shared-types": r("../../packages/shared-types/src/index.ts"),
      "@kawkab/config": r("../../packages/config/src/index.ts"),
      "@kawkab/validation": r("../../packages/validation/src/index.ts"),
      "@kawkab/simulation": r("../../packages/simulation/src/index.ts"),
      "@kawkab/ai": r("../../packages/ai/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000,
    environment: "node",
  },
});
