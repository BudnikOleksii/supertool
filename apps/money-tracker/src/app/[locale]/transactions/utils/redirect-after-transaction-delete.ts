import { revalidatePath } from 'next/cache';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';

import { fetchTransactions } from '../../../../actions/fetch-transactions';
import { ROUTES } from '../../../../constants/routes';
import { EMPTY_LIST_LENGTH, FIRST_PAGE, TRANSACTIONS_PAGE_SIZE } from '../constants';
import { buildTransactionsRedirectQuery } from './build-transactions-redirect-query';
import { getMonthDateRange, parsePeriod } from './period';

const COUNT_PROBE_LIMIT = 1;

const getLastPageForPeriod = async (period: string): Promise<number> => {
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(period));
  const result = await fetchTransactions({
    dateFrom,
    dateTo,
    page: FIRST_PAGE,
    limit: COUNT_PROBE_LIMIT,
  });

  if (result.status === 'error') {
    return FIRST_PAGE;
  }

  const { total } = result.transactions.meta;

  if (total === EMPTY_LIST_LENGTH) {
    return FIRST_PAGE;
  }

  return Math.ceil(total / TRANSACTIONS_PAGE_SIZE);
};

export const redirectAfterTransactionDelete = async (
  period: string,
  page: number,
  locale: string,
): Promise<never> => {
  const lastPage = await getLastPageForPeriod(period);
  const targetPage = Math.min(page, lastPage);

  revalidatePath(ROUTES.transactions);

  return redirect({
    href: {
      pathname: ROUTES.transactions,
      query: buildTransactionsRedirectQuery(period, targetPage),
    },
    locale,
  });
};
