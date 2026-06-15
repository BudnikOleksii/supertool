import type { TransactionsSearchParams } from './parse-transactions-search-params';

export const checkHasActiveFilters = (params: TransactionsSearchParams): boolean =>
  params.type !== undefined || params.categoryId !== undefined;
