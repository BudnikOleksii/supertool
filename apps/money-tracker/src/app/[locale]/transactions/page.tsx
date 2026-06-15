import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { Link, redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { fetchCategoryList } from '../../../actions/fetch-category-list';
import { fetchProfile } from '../../../actions/fetch-profile';
import { MonthStepper } from '../../../components/month-stepper/MonthStepper';
import { ROUTES } from '../../../constants/routes';
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

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  const translate = await getTranslations(I18N_NAMESPACE.transactionsPage);
  const params = parseTransactionsSearchParams(searchParams);
  const categoryList = await fetchCategoryList();

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <Typography variant="title-l">{translate('title')}</Typography>
        <div className={styles.controls}>
          <MonthStepper period={params.period} />
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
