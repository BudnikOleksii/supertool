import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: 'react-jsx' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
