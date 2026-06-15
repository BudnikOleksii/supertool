'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { TransactionCategoriesApiService } from '@supertool/shared/generated/sdk.gen';

import type { CategoryFormValues } from '../app/[locale]/categories/constants/category-form-schema';

import { categoryFormSchema } from '../app/[locale]/categories/constants/category-form-schema';
import { ROUTES } from '../constants/routes';

export const createCategory = async (values: CategoryFormValues): Promise<ActionState> => {
  const parsed = categoryFormSchema.safeParse(values);

  if (!parsed.success) {
    return { status: 'error', code: ErrorCode.ValidationError };
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { data, error } = await TransactionCategoriesApiService.transactionCategoriesCreate({
    client: createServerApiClient({ cookieHeader }),
    body: {
      name: parsed.data.name,
      type: parsed.data.type,
      ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
    },
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  revalidatePath(ROUTES.categories);

  return { status: 'success' };
};
