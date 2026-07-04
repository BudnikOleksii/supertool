'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE as UNKNOWN } from '@supertool/next-shared/src/types/action-state';
import type { ErrorCode } from '@supertool/shared/constants/error-codes';
import { TransactionCategoriesApiService } from '@supertool/shared/generated/sdk.gen';
import type { DefaultCategoriesResponseDto } from '@supertool/shared/generated/types.gen';

import { ROUTES } from '../constants/routes';

export type AssignDefaultCategoriesState =
  | { status: 'success'; result: DefaultCategoriesResponseDto }
  | { status: 'error'; code: ErrorCode | typeof UNKNOWN_ERROR_CODE; message?: string };

export const assignDefaultCategories = async (): Promise<AssignDefaultCategoriesState> => {
  const cookieStore = await cookies();
  const { data, error } = await TransactionCategoriesApiService.transactionCategoriesCreateDefaults(
    {
      client: createServerApiClient({ cookieHeader: cookieStore.toString() }),
    },
  );

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN, message: error?.message };
  }

  revalidatePath(ROUTES.categories);

  return { status: 'success', result: data };
};
