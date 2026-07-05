import { describe, expect, it } from 'vitest';

import { FIRST_PAGE, MAX_PAGE } from '@supertool/shared/constants/pagination';
import { TRANSACTION_SEARCH_MAX_LENGTH } from '@supertool/shared/constants/transaction-search';

import { parseTransactionsSearchParams } from './parse-transactions-search-params';

const PERIOD = '2025-03';
const EXTRA_SEARCH_LENGTH = 10;

describe('parseTransactionsSearchParams', () => {
  it('assigns the resolved period and reads the page from the search params', () => {
    const inputPage = '2';
    const actual = parseTransactionsSearchParams({ page: inputPage }, PERIOD);

    expect(actual.period).toBe(PERIOD);
    expect(actual.page).toBe(Number(inputPage));
  });

  it('defaults the page and sort while passing the resolved period through', () => {
    expect(parseTransactionsSearchParams({}, PERIOD)).toEqual({
      period: PERIOD,
      page: FIRST_PAGE,
      type: undefined,
      categoryId: undefined,
      search: undefined,
      sortBy: 'date',
      sortOrder: 'desc',
    });
  });

  it('falls back to the first page for a non-positive or non-integer page', () => {
    expect(parseTransactionsSearchParams({ page: '0' }, PERIOD).page).toBe(FIRST_PAGE);
    expect(parseTransactionsSearchParams({ page: 'abc' }, PERIOD).page).toBe(FIRST_PAGE);
  });

  it('clamps a page above the maximum to the maximum bound', () => {
    expect(parseTransactionsSearchParams({ page: '10001' }, PERIOD).page).toBe(MAX_PAGE);
  });

  it('parses a valid type filter and ignores an unknown one', () => {
    expect(parseTransactionsSearchParams({ type: 'expense' }, PERIOD).type).toBe('expense');
    expect(parseTransactionsSearchParams({ type: 'invalid' }, PERIOD).type).toBeUndefined();
  });

  it('passes a non-empty category id through and drops an empty one', () => {
    expect(parseTransactionsSearchParams({ categoryId: 'category-id' }, PERIOD).categoryId).toBe(
      'category-id',
    );
    expect(parseTransactionsSearchParams({ categoryId: '   ' }, PERIOD).categoryId).toBeUndefined();
  });

  it('trims a non-empty search and drops a whitespace-only one', () => {
    expect(parseTransactionsSearchParams({ search: '  coffee  ' }, PERIOD).search).toBe('coffee');
    expect(parseTransactionsSearchParams({ search: '   ' }, PERIOD).search).toBeUndefined();
    expect(parseTransactionsSearchParams({}, PERIOD).search).toBeUndefined();
  });

  it('clamps a search longer than the maximum length', () => {
    const longSearch = 'x'.repeat(TRANSACTION_SEARCH_MAX_LENGTH + EXTRA_SEARCH_LENGTH);

    expect(parseTransactionsSearchParams({ search: longSearch }, PERIOD).search).toHaveLength(
      TRANSACTION_SEARCH_MAX_LENGTH,
    );
  });

  it('parses valid sort params and falls back to the defaults for invalid ones', () => {
    const actual = parseTransactionsSearchParams({ sortBy: 'amount', sortOrder: 'asc' }, PERIOD);

    expect(actual.sortBy).toBe('amount');
    expect(actual.sortOrder).toBe('asc');

    const fallback = parseTransactionsSearchParams(
      { sortBy: 'name', sortOrder: 'sideways' },
      PERIOD,
    );

    expect(fallback.sortBy).toBe('date');
    expect(fallback.sortOrder).toBe('desc');
  });
});
