import { z } from 'zod';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';

import { TRANSACTION_TYPE_LIST } from '../../../../constants/transaction';
import { checkIsCalendarDate } from '../utils/check-is-calendar-date';
import { normalizeAmount } from '../utils/normalize-amount';

const POSITIVE_AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)\d{1,12}(?:\.\d{1,2})?$/u;
const CATEGORY_ID_MIN_LENGTH = 1;

export const transactionFormSchema = z.object({
  type: z.enum(TRANSACTION_TYPE_LIST, 'typeInvalid'),
  amount: z
    .string('amountInvalid')
    .trim()
    .regex(POSITIVE_AMOUNT_PATTERN, 'amountInvalid')
    .transform(normalizeAmount),
  currency: z.enum(CURRENCY_CODE_LIST, 'currencyInvalid'),
  categoryId: z.string().min(CATEGORY_ID_MIN_LENGTH, 'categoryRequired'),
  date: z.string().refine(checkIsCalendarDate, 'dateInvalid'),
  note: z.string().trim().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
