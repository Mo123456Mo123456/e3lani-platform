import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@e3lani/ui', '@e3lani/config', '@e3lani/i18n', '@e3lani/types', '@e3lani/api-client'],
};

export default nextConfig;
