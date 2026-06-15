import type { CreateTransactionDto } from '@supertool/shared/generated/types.gen';

import type { TransactionFormValues } from '../constants/transaction-form-schema';

export const buildTransactionRequestBody = (
  values: TransactionFormValues,
): CreateTransactionDto => ({
  type: values.type,
  amount: values.amount,
  currency: values.currency,
  categoryId: values.categoryId,
  date: values.date,
  ...(values.note ? { note: values.note } : {}),
});
