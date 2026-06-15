import type { TransactionsSearchParams } from './parse-transactions-search-params';

export const buildTransactionsSuspenseKey = (params: TransactionsSearchParams): string =>
  [
    params.period,
    String(params.page),
    params.type ?? '',
    params.categoryId ?? '',
    params.sortBy,
    params.sortOrder,
  ].join('-');
