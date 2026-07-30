/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kawkab/shared-types", "@kawkab/ui"],
  experimental: {
    optimizePackageImports: ["@react-three/drei", "@react-three/fiber"]
  }
};

export default nextConfig;
