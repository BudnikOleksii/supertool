import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { fetchCategoryList } from '../../../actions/fetch-category-list';
import { MonthNavigator } from '../../../components/month-navigator/MonthNavigator';
import { ROUTES } from '../../../constants/routes';
import { PERIOD_SEARCH_PARAM } from '../../../constants/search-params';
import { normalizeSearchParam } from '../../../utils/normalize-search-param';
import { getMonthDateRange, parsePeriod } from '../../../utils/period';
import { resolveDefaultPeriod } from '../../../utils/resolve-default-period';
import { resolveOnboardedProfile } from '../../../utils/resolve-onboarded-profile';
import { ExportMenu } from './components/export-menu/ExportMenu';
import { TransactionFilters } from './components/transaction-filters/TransactionFilters';
import { TransactionListServer } from './components/transaction-list-server/TransactionListServer';
import { TransactionListSkeleton } from './components/transaction-list-skeleton/TransactionListSkeleton';
import styles from './page.module.scss';
import { buildTransactionsSuspenseKey } from './utils/build-transactions-suspense-key';
import { checkHasActiveFilters } from './utils/check-has-active-filters';
import { parseTransactionsSearchParams } from './utils/parse-transactions-search-params';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const transactionListFallback = <TransactionListSkeleton />;

const TransactionsPage: FC<Props> = async (props) => {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);

  setRequestLocale(locale);

  await resolveOnboardedProfile(locale);

  const translate = await getTranslations(I18N_NAMESPACE.transactionsPage);
  const period = await resolveDefaultPeriod(
    normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM]),
  );
  const params = parseTransactionsSearchParams(searchParams, period);
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(params.period));
  const categoryList = await fetchCategoryList();

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <Typography variant="title-l">{translate('title')}</Typography>
        <div className={styles.controls}>
          <MonthNavigator period={params.period} />
          <ExportMenu
            namespace={I18N_NAMESPACE.transactionsPage}
            filters={{
              dateFrom,
              dateTo,
              sortBy: params.sortBy,
              sortOrder: params.sortOrder,
              ...(params.type === undefined ? {} : { type: params.type }),
              ...(params.categoryId === undefined ? {} : { categoryId: params.categoryId }),
            }}
          />
          <Button component={Link} href={ROUTES.transactionsNew}>
            {translate('addTransaction')}
          </Button>
        </div>
      </header>
      <TransactionFilters categoryList={categoryList} params={params} />
      <Suspense key={buildTransactionsSuspenseKey(params)} fallback={transactionListFallback}>
        <TransactionListServer
          period={params.period}
          page={params.page}
          locale={locale}
          type={params.type}
          categoryId={params.categoryId}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          hasActiveFilters={checkHasActiveFilters(params)}
        />
      </Suspense>
    </section>
  );
};

export default TransactionsPage;
