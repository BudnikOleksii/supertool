import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';
import { join } from 'node:path';

import { env } from './src/env';

const withNextIntl = createNextIntlPlugin();

const MONOREPO_ROOT = join(import.meta.dirname, '../../');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: MONOREPO_ROOT,
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  transpilePackages: [
    '@supertool/ui',
    '@supertool/shell',
    '@supertool/next-shared',
    '@supertool/widgets',
  ],
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${env.API_URL}/api/:path*`,
    },
  ],
};

export default withNextIntl(nextConfig);
