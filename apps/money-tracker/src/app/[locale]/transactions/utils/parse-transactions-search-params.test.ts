import { describe, expect, it } from 'vitest';

import { parseTransactionsSearchParams } from './parse-transactions-search-params';
import { getCurrentPeriod } from './period';

const FIRST_PAGE = 1;
const SECOND_PAGE = 2;

describe('parseTransactionsSearchParams', () => {
  it('reads a valid period and page from the search params', () => {
    expect(parseTransactionsSearchParams({ period: '2025-03', page: '2' })).toEqual({
      period: '2025-03',
      page: SECOND_PAGE,
    });
  });

  it('defaults to the current month and first page when params are absent', () => {
    expect(parseTransactionsSearchParams({})).toEqual({
      period: getCurrentPeriod(),
      page: FIRST_PAGE,
    });
  });

  it('takes the first value when a param arrives as an array', () => {
    expect(parseTransactionsSearchParams({ period: ['2025-05', '2025-06'] }).period).toBe(
      '2025-05',
    );
  });

  it('falls back to the first page for a non-positive or non-integer page', () => {
    expect(parseTransactionsSearchParams({ page: '0' }).page).toBe(FIRST_PAGE);
    expect(parseTransactionsSearchParams({ page: 'abc' }).page).toBe(FIRST_PAGE);
  });
});
