/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // الواجهة لا تتصل بأي خدمة خارجية — كل الطلبات تذهب إلى VERO API الخاص بالشركة
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    NEXT_PUBLIC_MAP_STYLE: process.env.NEXT_PUBLIC_MAP_STYLE ?? '',
  },
};

export default nextConfig;
