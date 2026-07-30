/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@planet/analytics', '@planet/config'],
};

export default nextConfig;
