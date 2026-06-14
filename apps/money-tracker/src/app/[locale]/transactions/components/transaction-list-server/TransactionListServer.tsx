import type { FC } from 'react';

import { fetchTransactions } from '../../../../../actions/fetch-transactions';
import { EMPTY_LIST_LENGTH, TRANSACTIONS_PAGE_SIZE } from '../../constants';
import { getMonthDateRange, parsePeriod } from '../../utils/period';
import { TransactionEmptyState } from '../transaction-empty-state/TransactionEmptyState';
import { TransactionError } from '../transaction-error/TransactionError';
import { TransactionList } from '../transaction-list/TransactionList';

interface Props {
  period: string;
  page: number;
  locale: string;
}

export const TransactionListServer: FC<Props> = async ({ period, page, locale }) => {
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(period));

  const result = await fetchTransactions({
    dateFrom,
    dateTo,
    page,
    limit: TRANSACTIONS_PAGE_SIZE,
  });

  if (result.status === 'error') {
    return <TransactionError />;
  }

  const transactionList = result.transactions.data;

  if (transactionList.length === EMPTY_LIST_LENGTH) {
    return <TransactionEmptyState />;
  }

  return <TransactionList transactionList={transactionList} locale={locale} />;
};
