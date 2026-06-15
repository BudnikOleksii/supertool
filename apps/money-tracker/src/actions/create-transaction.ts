'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

import type { TransactionFormValues } from '../app/[locale]/transactions/constants/transaction-form-schema';

import { PERIOD_SEARCH_PARAM } from '../app/[locale]/transactions/constants';
import { transactionFormSchema } from '../app/[locale]/transactions/constants/transaction-form-schema';
import { ROUTES } from '../constants/routes';

const PERIOD_START_INDEX = 0;
const PERIOD_LENGTH = 7;

const getCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();

  return cookieStore.toString();
};

const buildRequestBody = (values: TransactionFormValues) => ({
  type: values.type,
  amount: values.amount,
  currency: values.currency,
  categoryId: values.categoryId,
  date: values.date,
  ...(values.note ? { note: values.note } : {}),
});

export const createTransaction = async (
  values: TransactionFormValues,
  locale: string,
): Promise<ActionState> => {
  const parsed = transactionFormSchema.safeParse(values);

  if (!parsed.success) {
    return { status: 'error', code: ErrorCode.ValidationError };
  }

  const cookieHeader = await getCookieHeader();
  const { data, error } = await TransactionsApiService.transactionsCreate({
    client: createServerApiClient({ cookieHeader }),
    body: buildRequestBody(parsed.data),
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  const period = parsed.data.date.slice(PERIOD_START_INDEX, PERIOD_LENGTH);

  revalidatePath(ROUTES.transactions);

  return redirect({
    href: { pathname: ROUTES.transactions, query: { [PERIOD_SEARCH_PARAM]: period } },
    locale,
  });
};
