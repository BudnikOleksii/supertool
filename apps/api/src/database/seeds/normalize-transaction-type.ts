import type { TransactionType } from '../schemas/enums';

const SOURCE_INCOME = 'Income';

export const normalizeTransactionType = (sourceType: string): TransactionType =>
  sourceType === SOURCE_INCOME ? 'income' : 'expense';
