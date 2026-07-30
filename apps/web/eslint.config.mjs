import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL(".", import.meta.url)) });
export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([".next/**", "next-env.d.ts"]),
]);
