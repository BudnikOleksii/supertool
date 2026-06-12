import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  core: {
    disableTelemetry: true,
  },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    css: {
      ...viteConfig.css,
      preprocessorOptions: {
        ...viteConfig.css?.preprocessorOptions,
        scss: {
          additionalData: "@use 'breakpoints' as *;\n@use 'mixins' as *;\n",
          loadPaths: [`${process.cwd()}/../../packages/ui/src/styles`],
        },
      },
    },
  }),
};

export default config;
