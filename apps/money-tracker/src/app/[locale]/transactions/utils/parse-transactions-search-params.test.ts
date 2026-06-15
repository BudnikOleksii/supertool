import { describe, expect, it } from 'vitest';

import { FIRST_PAGE, MAX_PAGE } from '@supertool/shared/constants/pagination';

import { getCurrentPeriod } from '../../../../utils/period';
import { parseTransactionsSearchParams } from './parse-transactions-search-params';

describe('parseTransactionsSearchParams', () => {
  it('reads a valid period and page from the search params', () => {
    const inputPage = '2';
    const actual = parseTransactionsSearchParams({ period: '2025-03', page: inputPage });

    expect(actual.period).toBe('2025-03');
    expect(actual.page).toBe(Number(inputPage));
  });

  it('defaults to the current month, first page, and default sort when params are absent', () => {
    expect(parseTransactionsSearchParams({})).toEqual({
      period: getCurrentPeriod(),
      page: FIRST_PAGE,
      type: undefined,
      categoryId: undefined,
      sortBy: 'date',
      sortOrder: 'desc',
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

  it('clamps a page above the maximum to the maximum bound', () => {
    expect(parseTransactionsSearchParams({ page: '10001' }).page).toBe(MAX_PAGE);
  });

  it('parses a valid type filter and ignores an unknown one', () => {
    expect(parseTransactionsSearchParams({ type: 'expense' }).type).toBe('expense');
    expect(parseTransactionsSearchParams({ type: 'invalid' }).type).toBeUndefined();
  });

  it('passes a non-empty category id through and drops an empty one', () => {
    expect(parseTransactionsSearchParams({ categoryId: 'category-id' }).categoryId).toBe(
      'category-id',
    );
    expect(parseTransactionsSearchParams({ categoryId: '   ' }).categoryId).toBeUndefined();
  });

  it('parses valid sort params and falls back to the defaults for invalid ones', () => {
    const actual = parseTransactionsSearchParams({ sortBy: 'amount', sortOrder: 'asc' });

    expect(actual.sortBy).toBe('amount');
    expect(actual.sortOrder).toBe('asc');

    const fallback = parseTransactionsSearchParams({ sortBy: 'name', sortOrder: 'sideways' });

    expect(fallback.sortBy).toBe('date');
    expect(fallback.sortOrder).toBe('desc');
  });
});
