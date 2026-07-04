import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { TransactionType } from '@supertool/shared/generated/types.gen';
import { Badge } from '@supertool/ui/src/components/atoms/badge/Badge';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchTransactions } from '../../../../../actions/fetch-transactions';
import { ROUTES } from '../../../../../constants/routes';
import { RECENT_TRANSACTIONS_LIMIT } from '../../../../../constants/search-params';
import { formatAmount } from '../../../../../utils/format-amount';
import { formatTransactionDate } from '../../../transactions/utils/format-transaction-date';
import { getCategoryLabel } from '../../../transactions/utils/get-category-label';
import styles from './DashboardRecentTransactions.module.scss';

interface Props {
  dateFrom: string;
  dateTo: string;
  locale: string;
  type?: TransactionType | undefined;
}

const EMPTY_LIST_LENGTH = 0;
const FIRST_PAGE = 1;
const INCOME_TYPE = 'income';

export const DashboardRecentTransactions: FC<Props> = async ({
  dateFrom,
  dateTo,
  locale,
  type,
}) => {
  const translate = await getTranslations(`${I18N_NAMESPACE.dashboardPage}.recentTransactions`);

  const result = await fetchTransactions({
    dateFrom,
    dateTo,
    type,
    page: FIRST_PAGE,
    limit: RECENT_TRANSACTIONS_LIMIT,
    sortBy: 'date',
    sortOrder: 'desc',
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

  const { data } = result.transactions;

  if (data.length === EMPTY_LIST_LENGTH) {
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
        <div className={styles.header}>
          <Typography variant="title-s">{translate('title')}</Typography>
          <Link href={ROUTES.transactions} className={styles.viewAll}>
            {translate('viewAll')}
          </Link>
        </div>
        <ul className={styles.list}>
          {data.map((transaction) => (
            <li key={transaction.id} className={styles.item}>
              <div className={styles.primary}>
                <Typography variant="body-m" fontWeight="semibold" className={styles.amount}>
                  {formatAmount(transaction.amount, transaction.currency, locale)}
                </Typography>
                <Badge variant={transaction.type === INCOME_TYPE ? 'success' : 'secondary'}>
                  {translate(transaction.type === INCOME_TYPE ? 'typeIncome' : 'typeExpense')}
                </Badge>
              </div>
              <div className={styles.secondary}>
                <Typography variant="body-s" className={styles.category}>
                  {getCategoryLabel(transaction)}
                </Typography>
                <Typography variant="body-s" className={styles.date}>
                  {formatTransactionDate(transaction.date, locale)}
                </Typography>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
