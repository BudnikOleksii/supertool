import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';

import { NO_CURRENCY } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { TrendMonthDto } from '@supertool/shared/generated/types.gen';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchMonthlyTrend } from '../../../../../actions/fetch-monthly-trend';
import {
  getPeriodFromDate,
  getTrailingMonthsRange,
  parsePeriod,
} from '../../../../../utils/period';
import styles from './DashboardTrend.module.scss';

const DashboardTrendContent = dynamic(
  () => import('./DashboardTrendContent').then((mod) => mod.DashboardTrendContent),
  { loading: () => null },
);

interface Props {
  dateFrom: string;
  dateTo: string;
  locale: string;
}

const TRAILING_MONTHS = 12;
const ZERO_AMOUNT = '0.00';
const MONTH_INDEX_OFFSET = 1;
const FIRST_DAY_OF_MONTH = 1;

const formatMonthLabel = (month: string, locale: string): string => {
  const [yearPart, monthPart] = month.split('-');
  const date = new Date(
    Number(yearPart),
    Number(monthPart) - MONTH_INDEX_OFFSET,
    FIRST_DAY_OF_MONTH,
  );

  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(date);
};

const checkIsEmptyTrend = (trend: TrendMonthDto[]): boolean =>
  trend.every((month) => month.income === ZERO_AMOUNT && month.expense === ZERO_AMOUNT);

export const DashboardTrend: FC<Props> = async ({ dateTo, locale }) => {
  const translate = await getTranslations(`${I18N_NAMESPACE.dashboardPage}.trend`);
  const trailingRange = getTrailingMonthsRange(
    parsePeriod(getPeriodFromDate(dateTo)),
    TRAILING_MONTHS,
  );

  const result = await fetchMonthlyTrend({
    dateFrom: trailingRange.dateFrom,
    dateTo: trailingRange.dateTo,
  });

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

  const { trend, currency } = result.trend;

  if (currency === NO_CURRENCY || checkIsEmptyTrend(trend)) {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('empty.title')}</Typography>
          <Typography variant="body-m">{translate('empty.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = trend.map((month) => ({
    label: formatMonthLabel(month.month, locale),
    income: Number(month.income),
    expense: Number(month.expense),
    incomeAmount: month.income,
    expenseAmount: month.expense,
  }));

  return (
    <Card>
      <CardContent className={styles.content}>
        <Typography variant="title-s">{translate('title')}</Typography>
        <div className={styles.chart}>
          <DashboardTrendContent
            chartData={chartData}
            incomeName={translate('income')}
            expenseName={translate('expense')}
            currency={currency}
            locale={locale}
          />
        </div>
      </CardContent>
    </Card>
  );
};
