import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      "@kawkab/shared-types": r("../../packages/shared-types/src/index.ts"),
      "@kawkab/simulation": r("../../packages/simulation/src/index.ts"),
      "@kawkab/config": r("../../packages/config/src/index.ts"),
      "@kawkab/analytics": r("../../packages/analytics/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
