import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { NO_CURRENCY } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';
import { cn } from '@supertool/ui/src/lib/utils';

import { fetchMonthlySummary } from '../../../../../actions/fetch-monthly-summary';
import { formatAmount } from '../../../../../utils/format-amount';
import styles from './DashboardSummary.module.scss';

interface Props {
  dateFrom: string;
  dateTo: string;
  locale: string;
}

const ZERO_VALUE = 0;

const checkIsEmptySummary = (income: string, expense: string, net: string): boolean =>
  Number(income) === ZERO_VALUE && Number(expense) === ZERO_VALUE && Number(net) === ZERO_VALUE;

export const DashboardSummary: FC<Props> = async ({ dateFrom, dateTo, locale }) => {
  const translate = await getTranslations(I18N_NAMESPACE.dashboardPage);

  const result = await fetchMonthlySummary({ dateFrom, dateTo });

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

  const { income, expense, net, currency } = result.summary;

  if (currency === NO_CURRENCY || checkIsEmptySummary(income, expense, net)) {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('empty.title')}</Typography>
          <Typography variant="body-m">{translate('empty.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const isNetNegative = Number(net) < ZERO_VALUE;

  return (
    <Card>
      <CardContent className={styles.grid}>
        <div className={styles.stat}>
          <Typography variant="body-s" className={styles.label}>
            {translate('summary.income')}
          </Typography>
          <Typography variant="title-m" className={styles.income}>
            {formatAmount(income, currency, locale)}
          </Typography>
        </div>
        <div className={styles.stat}>
          <Typography variant="body-s" className={styles.label}>
            {translate('summary.expense')}
          </Typography>
          <Typography variant="title-m" className={styles.expense}>
            {formatAmount(expense, currency, locale)}
          </Typography>
        </div>
        <div className={styles.stat}>
          <Typography variant="body-s" className={styles.label}>
            {translate('summary.net')}
          </Typography>
          <Typography
            variant="title-m"
            className={cn(isNetNegative ? styles.expense : styles.income)}
          >
            {formatAmount(net, currency, locale)}
          </Typography>
        </div>
      </CardContent>
    </Card>
  );
};
