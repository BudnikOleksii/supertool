import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { MonthNavigator } from '../../../../components/month-navigator/MonthNavigator';
import { PERIOD_SEARCH_PARAM } from '../../../../constants/search-params';
import { normalizeSearchParam } from '../../../../utils/normalize-search-param';
import { getMonthDateRange, parsePeriod } from '../../../../utils/period';
import { resolveDefaultPeriod } from '../../../../utils/resolve-default-period';
import { resolveOnboardedProfile } from '../../../../utils/resolve-onboarded-profile';
import { ByCategoryAccordion } from './components/by-category-accordion/ByCategoryAccordion';
import { ByCategorySkeleton } from './components/by-category-skeleton/ByCategorySkeleton';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const accordionFallback = <ByCategorySkeleton />;

const TransactionsByCategoryPage: FC<Props> = async (props) => {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);

  setRequestLocale(locale);

  await resolveOnboardedProfile(locale);

  const translate = await getTranslations(I18N_NAMESPACE.transactionsByCategoryPage);
  const period = await resolveDefaultPeriod(
    normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM]),
  );
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(period));

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <Typography variant="title-l">{translate('title')}</Typography>
        <MonthNavigator period={period} />
      </header>
      <Suspense key={period} fallback={accordionFallback}>
        <ByCategoryAccordion dateFrom={dateFrom} dateTo={dateTo} period={period} locale={locale} />
      </Suspense>
    </section>
  );
};

export default TransactionsByCategoryPage;
