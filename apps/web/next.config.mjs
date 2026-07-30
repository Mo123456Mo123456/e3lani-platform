import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(packageDirectory, "../.."),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@kawkab/shared-types", "@kawkab/simulation-models"],
};

export default nextConfig;
