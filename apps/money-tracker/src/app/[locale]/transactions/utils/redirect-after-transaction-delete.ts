import { revalidatePath } from 'next/cache';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '@supertool/shared/constants/pagination';

import type { TransactionViewParams } from './build-transactions-redirect-query';

import { fetchTransactions } from '../../../../actions/fetch-transactions';
import { ROUTES } from '../../../../constants/routes';
import { EMPTY_COUNT } from '../constants';
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

  if (total === EMPTY_COUNT) {
    return FIRST_PAGE;
  }

  return Math.ceil(total / DEFAULT_PAGE_SIZE);
};

interface RedirectAfterDeleteParams {
  period: string;
  page: number;
  locale: string;
  view: TransactionViewParams;
}

export const redirectAfterTransactionDelete = async ({
  period,
  page,
  locale,
  view,
}: RedirectAfterDeleteParams): Promise<never> => {
  const lastPage = await getLastPageForPeriod(period);
  const targetPage = Math.min(page, lastPage);

  revalidatePath(ROUTES.transactions);

  return redirect({
    href: {
      pathname: ROUTES.transactions,
      query: buildTransactionsRedirectQuery(period, targetPage, view),
    },
    locale,
  });
};
