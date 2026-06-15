import type { FC } from 'react';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { DEFAULT_PAGE_SIZE } from '@supertool/shared/constants/pagination';
import type {
  SortOrder,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';

import type { TransactionViewParams } from '../../utils/build-transactions-redirect-query';

import { fetchTransactions } from '../../../../../actions/fetch-transactions';
import { ROUTES } from '../../../../../constants/routes';
import { EMPTY_COUNT } from '../../constants';
import { buildTransactionsRedirectQuery } from '../../utils/build-transactions-redirect-query';
import { getMonthDateRange, parsePeriod } from '../../utils/period';
import { TransactionEmptyState } from '../transaction-empty-state/TransactionEmptyState';
import { TransactionError } from '../transaction-error/TransactionError';
import { TransactionList } from '../transaction-list/TransactionList';
import { TransactionPagination } from '../transaction-pagination/TransactionPagination';

interface RedirectWhenPageOutOfRangeParams {
  page: number;
  total: number;
  period: string;
  view: TransactionViewParams;
  locale: string;
}

const redirectWhenPageOutOfRange = ({
  page,
  total,
  period,
  view,
  locale,
}: RedirectWhenPageOutOfRangeParams): void => {
  const lastPage = Math.ceil(total / DEFAULT_PAGE_SIZE);

  if (page <= lastPage) {
    return;
  }

  redirect({
    href: {
      pathname: ROUTES.transactions,
      query: buildTransactionsRedirectQuery(period, lastPage, view),
    },
    locale,
  });
};

interface Props {
  period: string;
  page: number;
  locale: string;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
  hasActiveFilters: boolean;
}

export const TransactionListServer: FC<Props> = async ({
  period,
  page,
  locale,
  type,
  categoryId,
  sortBy,
  sortOrder,
  hasActiveFilters,
}) => {
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(period));

  const result = await fetchTransactions({
    dateFrom,
    dateTo,
    page,
    limit: DEFAULT_PAGE_SIZE,
    type,
    categoryId,
    sortBy,
    sortOrder,
  });

  if (result.status === 'error') {
    return <TransactionError />;
  }

  const transactionList = result.transactions.data;
  const { meta } = result.transactions;

  if (meta.total === EMPTY_COUNT) {
    return (
      <TransactionEmptyState
        variant={hasActiveFilters ? 'noMatches' : 'emptyMonth'}
        period={period}
      />
    );
  }

  redirectWhenPageOutOfRange({
    page,
    total: meta.total,
    period,
    view: { type, categoryId, sortBy, sortOrder },
    locale,
  });

  return (
    <>
      <TransactionList
        transactionList={transactionList}
        locale={locale}
        period={period}
        page={page}
        type={type}
        categoryId={categoryId}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
      <TransactionPagination page={meta.page} limit={meta.limit} total={meta.total} />
    </>
  );
};
