import { revalidatePath } from 'next/cache';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '@supertool/shared/constants/pagination';

import { fetchTransactions } from '../../../../actions/fetch-transactions';
import { ROUTES } from '../../../../constants/routes';
import { buildTransactionsRedirectQuery } from './build-transactions-redirect-query';
import { getNextCalendarDate } from './get-next-calendar-date';
import { getMonthDateRange, parsePeriod } from './period';

const PERIOD_START_INDEX = 0;
const PERIOD_LENGTH = 7;
const COUNT_PROBE_LIMIT = 1;

const getTransactionPage = async (date: string, period: string): Promise<number> => {
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

  return Math.floor(transactionsBefore / DEFAULT_PAGE_SIZE) + FIRST_PAGE;
};

export const redirectToTransactionMonth = async (date: string, locale: string): Promise<never> => {
  const period = date.slice(PERIOD_START_INDEX, PERIOD_LENGTH);
  const page = await getTransactionPage(date, period);

  revalidatePath(ROUTES.transactions);

  return redirect({
    href: { pathname: ROUTES.transactions, query: buildTransactionsRedirectQuery(period, page) },
    locale,
  });
};
