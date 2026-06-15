'use server';

import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

import type { TransactionFormValues } from '../app/[locale]/transactions/constants/transaction-form-schema';

import { transactionFormSchema } from '../app/[locale]/transactions/constants/transaction-form-schema';
import { buildTransactionRequestBody } from '../app/[locale]/transactions/utils/build-transaction-request-body';
import { redirectToTransactionMonth } from '../app/[locale]/transactions/utils/redirect-to-transaction-month';

const getCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();

  return cookieStore.toString();
};

export const updateTransaction = async (
  id: string,
  values: TransactionFormValues,
  locale: string,
): Promise<ActionState> => {
  const parsed = transactionFormSchema.safeParse(values);

  if (!parsed.success) {
    return { status: 'error', code: ErrorCode.ValidationError };
  }

  const cookieHeader = await getCookieHeader();
  const { data, error } = await TransactionsApiService.transactionsUpdate({
    client: createServerApiClient({ cookieHeader }),
    path: { id },
    body: buildTransactionRequestBody(parsed.data),
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  return redirectToTransactionMonth(parsed.data.date, locale);
};
