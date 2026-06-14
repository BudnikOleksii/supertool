'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { TransactionCategoriesApiService } from '@supertool/shared/generated/sdk.gen';
import type { DeleteCategoryDto } from '@supertool/shared/generated/types.gen';

import { ROUTES } from '../constants/routes';

export const deleteCategory = async (
  id: string,
  reassignment: DeleteCategoryDto = {},
): Promise<ActionState> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { error } = await TransactionCategoriesApiService.transactionCategoriesRemove({
    client: createServerApiClient({ cookieHeader }),
    path: { id },
    body: reassignment,
  });

  if (error) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  revalidatePath(ROUTES.categories);

  return { status: 'success' };
};
