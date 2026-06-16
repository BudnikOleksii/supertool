import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { fetchProfile } from '../../../actions/fetch-profile';
import { MonthStepper } from '../../../components/month-stepper/MonthStepper';
import { ROUTES } from '../../../constants/routes';
import { PERIOD_SEARCH_PARAM } from '../../../constants/search-params';
import { normalizeSearchParam } from '../../../utils/normalize-search-param';
import { formatPeriod, parsePeriod } from '../../../utils/period';
import { DashboardSummarySkeleton } from './components/dashboard-summary-skeleton/DashboardSummarySkeleton';
import { DashboardSummary } from './components/dashboard-summary/DashboardSummary';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const summaryFallback = <DashboardSummarySkeleton />;

const DashboardPage: FC<Props> = async (props) => {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  const translate = await getTranslations(I18N_NAMESPACE.dashboardPage);
  const period = formatPeriod(parsePeriod(normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM])));

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <Typography variant="title-l">{translate('title')}</Typography>
        <MonthStepper period={period} />
      </header>
      <Suspense key={period} fallback={summaryFallback}>
        <DashboardSummary period={period} locale={locale} />
      </Suspense>
    </section>
  );
};

export default DashboardPage;
