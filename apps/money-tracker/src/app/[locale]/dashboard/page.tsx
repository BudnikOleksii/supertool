import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { MonthStepper } from '../../../components/month-stepper/MonthStepper';
import { PERIOD_SEARCH_PARAM } from '../../../constants/search-params';
import { normalizeSearchParam } from '../../../utils/normalize-search-param';
import { resolveDefaultPeriod } from '../../../utils/resolve-default-period';
import { resolveOnboardedProfile } from '../../../utils/resolve-onboarded-profile';
import { DashboardBreakdownSkeleton } from './components/dashboard-breakdown-skeleton/DashboardBreakdownSkeleton';
import { DashboardBreakdown } from './components/dashboard-breakdown/DashboardBreakdown';
import { DashboardSummarySkeleton } from './components/dashboard-summary-skeleton/DashboardSummarySkeleton';
import { DashboardSummary } from './components/dashboard-summary/DashboardSummary';
import { DashboardTrendSkeleton } from './components/dashboard-trend-skeleton/DashboardTrendSkeleton';
import { DashboardTrend } from './components/dashboard-trend/DashboardTrend';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const summaryFallback = <DashboardSummarySkeleton />;
const breakdownFallback = <DashboardBreakdownSkeleton />;
const trendFallback = <DashboardTrendSkeleton />;

const DashboardPage: FC<Props> = async (props) => {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);

  setRequestLocale(locale);

  await resolveOnboardedProfile(locale);

  const translate = await getTranslations(I18N_NAMESPACE.dashboardPage);
  const period = await resolveDefaultPeriod(
    normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM]),
  );

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <Typography variant="title-l">{translate('title')}</Typography>
        <MonthStepper period={period} />
      </header>
      <Suspense key={period} fallback={summaryFallback}>
        <DashboardSummary period={period} locale={locale} />
      </Suspense>
      <Suspense key={`breakdown-${period}`} fallback={breakdownFallback}>
        <DashboardBreakdown period={period} locale={locale} />
      </Suspense>
      <Suspense key={`trend-${period}`} fallback={trendFallback}>
        <DashboardTrend period={period} locale={locale} />
      </Suspense>
    </section>
  );
};

export default DashboardPage;
