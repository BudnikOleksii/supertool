'use server';

import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

import type { TransactionViewParams } from '../app/[locale]/transactions/utils/build-transactions-redirect-query';

import { redirectAfterTransactionDelete } from '../app/[locale]/transactions/utils/redirect-after-transaction-delete';

interface DeleteTransactionParams {
  id: string;
  period: string;
  page: number;
  locale: string;
  view: TransactionViewParams;
}

export const deleteTransaction = async ({
  id,
  period,
  page,
  locale,
  view,
}: DeleteTransactionParams): Promise<ActionState> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { error } = await TransactionsApiService.transactionsRemove({
    client: createServerApiClient({ cookieHeader }),
    path: { id },
  });

  if (error) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  return redirectAfterTransactionDelete({ period, page, locale, view });
};
