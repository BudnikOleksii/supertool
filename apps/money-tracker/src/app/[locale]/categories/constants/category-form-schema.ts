import { z } from 'zod';

import { NAME_MIN_LENGTH } from '@supertool/shared/constants/validation';

import { TRANSACTION_TYPE_LIST } from '../../../../constants/transaction';

export const categoryFormSchema = z.object({
  name: z.string('nameRequired').trim().min(NAME_MIN_LENGTH, 'nameRequired'),
  type: z.enum(TRANSACTION_TYPE_LIST, 'typeRequired'),
  parentId: z.string().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
