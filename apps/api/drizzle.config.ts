import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schemas',
  out: './src/database/migrations',
  dbCredentials: {
    // Default matches docker/docker-compose.yml for the local-only runtime (NFR3).
    url: process.env.DATABASE_URL ?? 'postgres://supertool:supertool@localhost:5432/supertool',
  },
});
