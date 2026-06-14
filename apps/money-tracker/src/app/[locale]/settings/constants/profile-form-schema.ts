import { z } from 'zod';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';

const NAME_MIN_LENGTH = 1;

export const profileFormSchema = z.object({
  name: z.string('nameRequired').trim().min(NAME_MIN_LENGTH, 'nameRequired'),
  locale: z.enum(LOCALE_CODE_LIST, 'localeInvalid'),
  defaultCurrency: z.enum(CURRENCY_CODE_LIST, 'currencyInvalid').optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
