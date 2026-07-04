import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { parseDashboardSearchParams } from '../../../utils/parse-dashboard-search-params';
import { resolveOnboardedProfile } from '../../../utils/resolve-onboarded-profile';
import { DashboardBreakdownSkeleton } from './components/dashboard-breakdown-skeleton/DashboardBreakdownSkeleton';
import { DashboardBreakdown } from './components/dashboard-breakdown/DashboardBreakdown';
import { DashboardDailySpendingSkeleton } from './components/dashboard-daily-spending-skeleton/DashboardDailySpendingSkeleton';
import { DashboardDailySpending } from './components/dashboard-daily-spending/DashboardDailySpending';
import { DashboardFilters } from './components/dashboard-filters/DashboardFilters';
import { DashboardRecentTransactionsSkeleton } from './components/dashboard-recent-transactions-skeleton/DashboardRecentTransactionsSkeleton';
import { DashboardRecentTransactions } from './components/dashboard-recent-transactions/DashboardRecentTransactions';
import { DashboardSummarySkeleton } from './components/dashboard-summary-skeleton/DashboardSummarySkeleton';
import { DashboardSummary } from './components/dashboard-summary/DashboardSummary';
import { DashboardTopCategoriesSkeleton } from './components/dashboard-top-categories-skeleton/DashboardTopCategoriesSkeleton';
import { DashboardTopCategories } from './components/dashboard-top-categories/DashboardTopCategories';
import { DashboardTrendSkeleton } from './components/dashboard-trend-skeleton/DashboardTrendSkeleton';
import { DashboardTrend } from './components/dashboard-trend/DashboardTrend';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const summaryFallback = <DashboardSummarySkeleton />;
const topCategoriesFallback = <DashboardTopCategoriesSkeleton />;
const breakdownFallback = <DashboardBreakdownSkeleton />;
const dailySpendingFallback = <DashboardDailySpendingSkeleton />;
const trendFallback = <DashboardTrendSkeleton />;
const recentTransactionsFallback = <DashboardRecentTransactionsSkeleton />;

const DashboardPage: FC<Props> = async (props) => {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);

  setRequestLocale(locale);

  await resolveOnboardedProfile(locale);

  const translate = await getTranslations(I18N_NAMESPACE.dashboardPage);
  const { dateFrom, dateTo, type } = await parseDashboardSearchParams(searchParams);

  const rangeKey = `${dateFrom}-${dateTo}`;

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <Typography variant="title-l">{translate('title')}</Typography>
      </header>
      <DashboardFilters dateFrom={dateFrom} dateTo={dateTo} type={type} />
      <Suspense key={`summary-${rangeKey}`} fallback={summaryFallback}>
        <DashboardSummary dateFrom={dateFrom} dateTo={dateTo} locale={locale} />
      </Suspense>
      <Suspense key={`top-categories-${rangeKey}`} fallback={topCategoriesFallback}>
        <DashboardTopCategories dateFrom={dateFrom} dateTo={dateTo} locale={locale} />
      </Suspense>
      <Suspense key={`breakdown-${rangeKey}`} fallback={breakdownFallback}>
        <DashboardBreakdown dateFrom={dateFrom} dateTo={dateTo} locale={locale} />
      </Suspense>
      <Suspense key={`daily-spending-${rangeKey}`} fallback={dailySpendingFallback}>
        <DashboardDailySpending dateFrom={dateFrom} dateTo={dateTo} locale={locale} />
      </Suspense>
      <Suspense key={`trend-${rangeKey}`} fallback={trendFallback}>
        <DashboardTrend dateFrom={dateFrom} dateTo={dateTo} locale={locale} />
      </Suspense>
      <Suspense key={`recent-${rangeKey}-${type ?? 'all'}`} fallback={recentTransactionsFallback}>
        <DashboardRecentTransactions
          dateFrom={dateFrom}
          dateTo={dateTo}
          type={type}
          locale={locale}
        />
      </Suspense>
    </section>
  );
};

export default DashboardPage;
