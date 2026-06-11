import { defineConfig } from 'drizzle-kit';

const LOCAL_COMPOSE_DATABASE_URL = 'postgres://supertool:supertool@localhost:5432/supertool';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schemas',
  out: './src/database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? LOCAL_COMPOSE_DATABASE_URL,
  },
});
