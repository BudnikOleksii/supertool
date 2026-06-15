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

import {
  FIRST_PAGE,
  PAGE_SEARCH_PARAM,
  PERIOD_SEARCH_PARAM,
  TRANSACTIONS_PAGE_SIZE,
} from '../app/[locale]/transactions/constants';
import { transactionFormSchema } from '../app/[locale]/transactions/constants/transaction-form-schema';
import { getNextCalendarDate } from '../app/[locale]/transactions/utils/get-next-calendar-date';
import { getMonthDateRange, parsePeriod } from '../app/[locale]/transactions/utils/period';
import { ROUTES } from '../constants/routes';
import { fetchTransactions } from './fetch-transactions';

const PERIOD_START_INDEX = 0;
const PERIOD_LENGTH = 7;
const COUNT_PROBE_LIMIT = 1;

const getCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();

  return cookieStore.toString();
};

const getCreatedTransactionPage = async (date: string, period: string): Promise<number> => {
  const { dateTo } = getMonthDateRange(parsePeriod(period));
  const result = await fetchTransactions({
    dateFrom: getNextCalendarDate(date),
    dateTo,
    page: FIRST_PAGE,
    limit: COUNT_PROBE_LIMIT,
  });

  if (result.status === 'error') {
    return FIRST_PAGE;
  }

  const transactionsBefore = result.transactions.meta.total;

  return Math.floor(transactionsBefore / TRANSACTIONS_PAGE_SIZE) + FIRST_PAGE;
};

const buildRequestBody = (values: TransactionFormValues) => ({
  type: values.type,
  amount: values.amount,
  currency: values.currency,
  categoryId: values.categoryId,
  date: values.date,
  ...(values.note ? { note: values.note } : {}),
});

const buildRedirectQuery = (period: string, page: number): Record<string, string> =>
  page > FIRST_PAGE
    ? { [PERIOD_SEARCH_PARAM]: period, [PAGE_SEARCH_PARAM]: String(page) }
    : { [PERIOD_SEARCH_PARAM]: period };

const redirectToCreatedTransaction = async (date: string, locale: string): Promise<never> => {
  const period = date.slice(PERIOD_START_INDEX, PERIOD_LENGTH);
  const page = await getCreatedTransactionPage(date, period);

  revalidatePath(ROUTES.transactions);

  return redirect({
    href: { pathname: ROUTES.transactions, query: buildRedirectQuery(period, page) },
    locale,
  });
};

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

  return redirectToCreatedTransaction(parsed.data.date, locale);
};
