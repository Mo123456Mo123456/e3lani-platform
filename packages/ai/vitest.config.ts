import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@kawkab/shared-types": r("../shared-types/src/index.ts"),
      "@kawkab/validation": r("../validation/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
