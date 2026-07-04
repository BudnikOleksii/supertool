import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';

import { NO_CURRENCY } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { DailySpendingDayDto } from '@supertool/shared/generated/types.gen';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchDailySpending } from '../../../../../actions/fetch-daily-spending';
import styles from './DashboardDailySpending.module.scss';

const DashboardDailySpendingContent = dynamic(
  () => import('./DashboardDailySpendingContent').then((mod) => mod.DashboardDailySpendingContent),
  { loading: () => null },
);

interface Props {
  dateFrom: string;
  dateTo: string;
  locale: string;
}

const ZERO_AMOUNT = '0.00';
const MONTH_INDEX_OFFSET = 1;

const formatDayLabel = (date: string, locale: string): string => {
  const [yearPart, monthPart, dayPart] = date.split('-');
  const parsedDate = new Date(
    Number(yearPart),
    Number(monthPart) - MONTH_INDEX_OFFSET,
    Number(dayPart),
  );

  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parsedDate);
};

const checkIsEmptyDailySpending = (days: DailySpendingDayDto[]): boolean =>
  days.every((day) => day.total === ZERO_AMOUNT);

export const DashboardDailySpending: FC<Props> = async ({ dateFrom, dateTo, locale }) => {
  const translate = await getTranslations(`${I18N_NAMESPACE.dashboardPage}.dailySpending`);

  const result = await fetchDailySpending({ dateFrom, dateTo });

  if (result.status === 'error') {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('error.title')}</Typography>
          <Typography variant="body-m">{translate('error.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const { days, currency } = result.dailySpending;

  if (currency === NO_CURRENCY || checkIsEmptyDailySpending(days)) {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('empty.title')}</Typography>
          <Typography variant="body-m">{translate('empty.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = days.map((day) => ({
    label: formatDayLabel(day.date, locale),
    value: Number(day.total),
    amount: day.total,
  }));

  return (
    <Card>
      <CardContent className={styles.content}>
        <Typography variant="title-s">{translate('title')}</Typography>
        <div className={styles.chart}>
          <DashboardDailySpendingContent
            chartData={chartData}
            expenseName={translate('expense')}
            currency={currency}
            locale={locale}
          />
        </div>
      </CardContent>
    </Card>
  );
};
