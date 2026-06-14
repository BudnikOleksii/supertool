import { afterEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from './run-migrations';
import { runSeed } from './run-seed';

vi.mock('./run-migrations', () => ({ runMigrations: vi.fn() }));
vi.mock('./run-seed', () => ({ runSeed: vi.fn() }));

const mockRunMigrations = vi.mocked(runMigrations);
const mockRunSeed = vi.mocked(runSeed);

const inputOptions = {
  databaseUrl: 'postgres://supertool:supertool@localhost:5432/supertool',
  migrationsFolder: '/app/dist/database/migrations',
};

describe('prepareDatabase boot sequence', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs migrations before the seed hook', async () => {
    const callOrderList: string[] = [];
    mockRunMigrations.mockImplementation(async () => {
      callOrderList.push('migrate');
      await Promise.resolve();
    });
    mockRunSeed.mockImplementation(async () => {
      callOrderList.push('seed');
      await Promise.resolve();
    });

    const { prepareDatabase } = await import('./prepare-database.js');
    await prepareDatabase(inputOptions);

    expect(callOrderList).toEqual(['migrate', 'seed']);
    expect(mockRunMigrations).toHaveBeenCalledWith(inputOptions);
  });

  it('aborts before seeding when migrations fail', async () => {
    const expectedError = new Error('migration failed');
    mockRunMigrations.mockRejectedValue(expectedError);
    mockRunSeed.mockResolvedValue();

    const { prepareDatabase } = await import('./prepare-database.js');

    await expect(prepareDatabase(inputOptions)).rejects.toThrow(expectedError);
    expect(mockRunSeed).not.toHaveBeenCalled();
  });
});
