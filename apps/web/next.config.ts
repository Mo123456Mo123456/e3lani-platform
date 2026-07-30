import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@planet/ui", "@planet/config", "@planet/shared-types"],
  experimental: {
    optimizePackageImports: ["@react-three/drei"],
  },
};

export default nextConfig;
