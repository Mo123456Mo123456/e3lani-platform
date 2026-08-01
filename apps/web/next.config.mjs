/** @type {import('next').NextConfig} */
const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL ?? 'http://localhost:9000/e3lani-media';
const { protocol, hostname, port } = new URL(mediaUrl);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@e3lani/ui', '@e3lani/config', '@e3lani/types'],
  images: {
    remotePatterns: [
      {
        protocol: protocol.replace(':', ''),
        hostname,
        port: port || undefined,
        pathname: '/**',
      },
    ],
  },
  experimental: { optimizePackageImports: ['lucide-react'] },

  // ملفات ربط التطبيق يجب أن تُقدَّم بنوع JSON وبلا تخزين مؤقت طويل،
  // وإلا رفضها iOS و Android عند التحقق من الروابط العميقة.
  async headers() {
    return [
      {
        source: '/.well-known/:file(apple-app-site-association|assetlinks.json)',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
    ];
  },
};

export default nextConfig;
