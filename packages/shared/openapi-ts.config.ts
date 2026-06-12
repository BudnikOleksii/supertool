import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../apps/api/openapi.json',
  output: { path: 'src/generated', clean: true },
  plugins: [
    '@hey-api/client-fetch',
    {
      name: '@hey-api/sdk',
      operations: {
        strategy: 'byTags',
        containerName: { name: '{{name}}ApiService', case: 'PascalCase' },
      },
    },
  ],
});
