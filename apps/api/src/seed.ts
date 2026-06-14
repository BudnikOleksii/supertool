import { parseEnv } from './app/env.schema';
import { runSeed } from './database/run-seed';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const seed = async (): Promise<void> => {
  const env = parseEnv();
  await runSeed({ databaseUrl: env.DATABASE_URL });
  process.stdout.write('Seed complete\n');
};

seed()
  .then(() => {
    process.exit(EXIT_SUCCESS);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(EXIT_FAILURE);
  });
