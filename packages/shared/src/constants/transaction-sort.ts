import type { ObjectValuesUnion } from '../types/object-values-union';

export const TRANSACTION_SORT_BY = {
  date: 'date',
  amount: 'amount',
} as const;

export type TransactionSortBy = ObjectValuesUnion<typeof TRANSACTION_SORT_BY>;

export const TRANSACTION_SORT_ORDER = {
  asc: 'asc',
  desc: 'desc',
} as const;

export type TransactionSortOrder = ObjectValuesUnion<typeof TRANSACTION_SORT_ORDER>;

export const TRANSACTION_SORT_BY_LIST = Object.values(TRANSACTION_SORT_BY);

export const TRANSACTION_SORT_ORDER_LIST = Object.values(TRANSACTION_SORT_ORDER);

export const DEFAULT_SORT_BY: TransactionSortBy = TRANSACTION_SORT_BY.date;

export const DEFAULT_SORT_ORDER: TransactionSortOrder = TRANSACTION_SORT_ORDER.desc;
