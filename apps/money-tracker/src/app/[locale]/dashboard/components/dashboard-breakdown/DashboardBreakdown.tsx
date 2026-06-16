import type { CSSProperties, FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { NO_CURRENCY } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchCategoryBreakdown } from '../../../../../actions/fetch-category-breakdown';
import { formatAmount } from '../../../../../utils/format-amount';
import { getMonthDateRange, parsePeriod } from '../../../../../utils/period';
import styles from './DashboardBreakdown.module.scss';

interface Props {
  period: string;
  locale: string;
}

const EMPTY_LIST_LENGTH = 0;
const PERCENT_DIVISOR = 100;
const MAX_SHARE_FRACTION_DIGITS = 1;

const formatShare = (share: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: MAX_SHARE_FRACTION_DIGITS,
  }).format(share / PERCENT_DIVISOR);

const getBarStyle = (share: number): CSSProperties & Record<`--${string}`, string> => ({
  '--bar-width': `${share}%`,
});

export const DashboardBreakdown: FC<Props> = async ({ period, locale }) => {
  const translate = await getTranslations(`${I18N_NAMESPACE.dashboardPage}.breakdown`);
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(period));

  const result = await fetchCategoryBreakdown({ dateFrom, dateTo });

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

  const { breakdown, currency } = result.breakdown;

  if (currency === NO_CURRENCY || breakdown.length === EMPTY_LIST_LENGTH) {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('empty.title')}</Typography>
          <Typography variant="body-m">{translate('empty.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className={styles.content}>
        <Typography variant="title-s">{translate('title')}</Typography>
        <ul className={styles.list}>
          {breakdown.map((item) => (
            <li key={item.categoryId} className={styles.item}>
              <div className={styles.header}>
                <Typography variant="body-m" className={styles.name}>
                  {item.categoryName}
                </Typography>
                <div className={styles.values}>
                  <Typography variant="body-s" className={styles.share}>
                    {formatShare(item.share, locale)}
                  </Typography>
                  <Typography variant="body-m" className={styles.total}>
                    {formatAmount(item.total, currency, locale)}
                  </Typography>
                </div>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={getBarStyle(item.share)} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
