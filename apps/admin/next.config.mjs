/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@e3lani/ui', '@e3lani/config', '@e3lani/types'],
  images: { unoptimized: true },
};

export default nextConfig;
