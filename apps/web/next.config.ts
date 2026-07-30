import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@planet/ui", "@planet/shared-types"],
  experimental: {
    optimizePackageImports: ["@react-three/drei"],
  },
};

export default nextConfig;
