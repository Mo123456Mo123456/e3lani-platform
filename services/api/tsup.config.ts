import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  splitting: false,
  clean: true,
  sourcemap: true,
  noExternal: [
    "@living-planet/shared-types",
    "@living-planet/simulation-models",
  ],
});
