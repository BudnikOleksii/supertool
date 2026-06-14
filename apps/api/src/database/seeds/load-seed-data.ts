import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import type { SeedSourceRecord } from './seed.types';

import { seedSourceRecordSchema } from './seed.types';

const SEED_DATA_FILE_NAME = 'transactions-02.03.25.json';

const seedRecordListSchema = z.array(seedSourceRecordSchema);

export const loadSeedData = (dataDir: string): SeedSourceRecord[] => {
  const filePath = join(dataDir, SEED_DATA_FILE_NAME);
  const raw = readFileSync(filePath, 'utf8');

  return seedRecordListSchema.parse(JSON.parse(raw));
};
