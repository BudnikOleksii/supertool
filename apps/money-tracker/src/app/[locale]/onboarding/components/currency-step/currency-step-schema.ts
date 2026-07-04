import { z } from 'zod';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';

export const currencyStepSchema = z.object({
  defaultCurrency: z.enum(CURRENCY_CODE_LIST, 'currencyRequired'),
});

export type CurrencyStepValues = z.infer<typeof currencyStepSchema>;
