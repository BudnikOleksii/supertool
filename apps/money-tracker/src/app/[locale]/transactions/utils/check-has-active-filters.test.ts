import { describe, expect, it } from 'vitest';

import type { TransactionsSearchParams } from './parse-transactions-search-params';

import { checkHasActiveFilters } from './check-has-active-filters';

const buildParams = (
  overrides: Partial<TransactionsSearchParams> = {},
): TransactionsSearchParams => ({
  period: '2025-03',
  page: 1,
  sortBy: 'date',
  sortOrder: 'desc',
  ...overrides,
});

describe('checkHasActiveFilters', () => {
  it('returns false when no type or category filter is set', () => {
    expect(checkHasActiveFilters(buildParams())).toBe(false);
  });

  it('returns true when a type filter is set', () => {
    expect(checkHasActiveFilters(buildParams({ type: 'expense' }))).toBe(true);
  });

  it('returns true when a category filter is set', () => {
    expect(checkHasActiveFilters(buildParams({ categoryId: 'category-id' }))).toBe(true);
  });

  it('ignores sort changes when deciding whether filters are active', () => {
    expect(checkHasActiveFilters(buildParams({ sortBy: 'amount', sortOrder: 'asc' }))).toBe(false);
  });
});
