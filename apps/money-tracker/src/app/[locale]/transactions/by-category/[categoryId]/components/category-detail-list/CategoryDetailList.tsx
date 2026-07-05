import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { DEFAULT_PAGE_SIZE } from '@supertool/shared/constants/pagination';
import { Badge } from '@supertool/ui/src/components/atoms/badge/Badge';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchTransactions } from '../../../../../../../actions/fetch-transactions';
import { formatAmount } from '../../../../../../../utils/format-amount';
import { TransactionPagination } from '../../../../components/transaction-pagination/TransactionPagination';
import { formatTransactionDate } from '../../../../utils/format-transaction-date';
import { getCategoryLabel } from '../../../../utils/get-category-label';
import styles from './CategoryDetailList.module.scss';

interface Props {
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  page: number;
  locale: string;
}

const EMPTY_LIST_LENGTH = 0;
const INCOME_TYPE = 'income';

export const CategoryDetailList: FC<Props> = async ({
  dateFrom,
  dateTo,
  categoryId,
  page,
  locale,
}) => {
  const translate = await getTranslations(I18N_NAMESPACE.transactionsByCategoryPage);

  const result = await fetchTransactions({
    dateFrom,
    dateTo,
    categoryId,
    page,
    limit: DEFAULT_PAGE_SIZE,
    sortBy: 'date',
    sortOrder: 'desc',
  });

  if (result.status === 'error') {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('detail.error.title')}</Typography>
          <Typography variant="body-m">{translate('detail.error.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const { data, meta } = result.transactions;

  if (data.length === EMPTY_LIST_LENGTH) {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('detail.empty.title')}</Typography>
          <Typography variant="body-m">{translate('detail.empty.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={styles.container}>
      <Card>
        <CardContent className={styles.content}>
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
      <TransactionPagination page={meta.page} limit={meta.limit} total={meta.total} />
    </div>
  );
};
