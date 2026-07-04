import type { CSSProperties, FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { TOP_CATEGORIES_DEFAULT_LIMIT } from '@supertool/shared/constants/analytics';
import { NO_CURRENCY } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchTopCategories } from '../../../../../actions/fetch-top-categories';
import { formatAmount } from '../../../../../utils/format-amount';
import styles from './DashboardTopCategories.module.scss';

interface Props {
  dateFrom: string;
  dateTo: string;
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

export const DashboardTopCategories: FC<Props> = async ({ dateFrom, dateTo, locale }) => {
  const translate = await getTranslations(`${I18N_NAMESPACE.dashboardPage}.topCategories`);

  const result = await fetchTopCategories({
    dateFrom,
    dateTo,
    limit: TOP_CATEGORIES_DEFAULT_LIMIT,
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

  const { categories, currency } = result.topCategories;

  if (currency === NO_CURRENCY || categories.length === EMPTY_LIST_LENGTH) {
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
          {categories.map((category) => (
            <li key={category.categoryId} className={styles.item}>
              <div className={styles.header}>
                <div className={styles.label}>
                  <Typography variant="body-s" className={styles.rank}>
                    {category.rank}
                  </Typography>
                  <Typography variant="body-m" className={styles.name}>
                    {category.categoryName}
                  </Typography>
                </div>
                <div className={styles.values}>
                  <Typography variant="body-s" className={styles.share}>
                    {formatShare(category.share, locale)}
                  </Typography>
                  <Typography variant="body-m" className={styles.total}>
                    {formatAmount(category.total, currency, locale)}
                  </Typography>
                </div>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={getBarStyle(category.share)} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
