import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

import { env } from './src/env';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ['@supertool/ui', '@supertool/shell', '@supertool/next-shared'],
  sassOptions: {
    additionalData: "@use 'breakpoints' as *;\n@use 'mixins' as *;\n",
    loadPaths: [`${process.cwd()}/../../packages/ui/src/styles`],
  },
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${env.API_URL}/api/:path*`,
    },
  ],
};

export default withNextIntl(nextConfig);
