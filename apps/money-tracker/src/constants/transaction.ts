import type { TransactionType } from '@supertool/shared/generated/types.gen';

export const TRANSACTION_TYPE_LIST = [
  'income',
  'expense',
] as const satisfies readonly TransactionType[];

export const TRANSACTION_TYPE = {
  income: 'income',
  expense: 'expense',
} as const satisfies Record<string, TransactionType>;
