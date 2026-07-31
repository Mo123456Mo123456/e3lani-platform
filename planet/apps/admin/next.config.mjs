/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // The admin panel is intentionally NOT linked from the public app;
  // deploy it behind network-level protection (VPN/allowlist).
};

export default nextConfig;
