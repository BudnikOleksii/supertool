import { z } from 'zod';

import { TRANSACTION_TYPE_LIST } from '../../../../constants/transaction';

const NAME_MIN_LENGTH = 1;

export const categoryFormSchema = z.object({
  name: z.string('nameRequired').trim().min(NAME_MIN_LENGTH, 'nameRequired'),
  type: z.enum(TRANSACTION_TYPE_LIST, 'typeRequired'),
  parentId: z.string().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
