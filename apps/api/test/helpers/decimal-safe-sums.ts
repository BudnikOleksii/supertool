import type { Pool } from 'pg';

import Decimal from 'decimal.js';
import { expect } from 'vitest';

import type { SeedSourceRecord } from '../../src/database/seeds/seed.types.js';

const MONEY_SCALE = 2;

export const getActualSumByCurrency = async (
  pool: Pool,
  userId: string,
): Promise<Map<string, string>> => {
  const result = await pool.query<{ currency: string; total: string }>(
    `SELECT currency, SUM(amount)::text AS total FROM transactions WHERE user_id = $1 GROUP BY currency`,
    [userId],
  );

  return new Map(result.rows.map((row) => [row.currency, row.total]));
};

export const getExpectedSumByCurrency = (recordList: SeedSourceRecord[]): Map<string, string> => {
  const totalByCurrency = new Map<string, Decimal>();

  recordList.forEach((record) => {
    const previous = totalByCurrency.get(record.Currency) ?? new Decimal(0);
    totalByCurrency.set(
      record.Currency,
      previous.plus(new Decimal(record.Amount).toDecimalPlaces(MONEY_SCALE)),
    );
  });

  return new Map(
    [...totalByCurrency].map(([currency, total]) => [currency, total.toFixed(MONEY_SCALE)]),
  );
};

export const assertDecimalSafeSums = async ({
  pool,
  userId,
  recordList,
}: {
  pool: Pool;
  userId: string;
  recordList: SeedSourceRecord[];
}): Promise<void> => {
  const actualSumByCurrency = await getActualSumByCurrency(pool, userId);
  const expectedSumByCurrency = getExpectedSumByCurrency(recordList);

  expect(actualSumByCurrency.size).toBe(expectedSumByCurrency.size);

  expectedSumByCurrency.forEach((expectedTotal, currency) => {
    expect(actualSumByCurrency.get(currency)).toBe(expectedTotal);
  });
};
