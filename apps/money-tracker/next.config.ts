import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

import { env } from './src/env';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ['@supertool/ui', '@supertool/shell', '@supertool/next-shared'],
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${env.API_URL}/api/:path*`,
    },
  ],
};

export default withNextIntl(nextConfig);
