import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { TRANSACTION_SORT_BY } from '@supertool/shared/constants/transaction-sort';
import type {
  SortOrder,
  TransactionResponseDto,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { formatTransactionDate } from '../../utils/format-transaction-date';
import { groupTransactionListByDate } from '../../utils/group-transaction-list-by-date';
import { TransactionCard } from '../transaction-card/TransactionCard';
import styles from './TransactionList.module.scss';

interface Props {
  transactionList: TransactionResponseDto[];
  locale: string;
  period: string;
  page: number;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
}

export const TransactionList: FC<Props> = async ({
  transactionList,
  locale,
  period,
  page,
  type,
  categoryId,
  sortBy,
  sortOrder,
}) => {
  const translate = await getTranslations(I18N_NAMESPACE.transactionsPage);

  const selectLabel = translate('bulkDelete.selectRow');

  const renderCard = (transaction: TransactionResponseDto) => (
    <TransactionCard
      key={transaction.id}
      transaction={transaction}
      locale={locale}
      typeLabel={translate(`type.${transaction.type}`)}
      selectLabel={selectLabel}
      period={period}
      page={page}
      type={type}
      categoryId={categoryId}
      sortBy={sortBy}
      sortOrder={sortOrder}
    />
  );

  if (sortBy !== TRANSACTION_SORT_BY.date) {
    return (
      <div className={styles.list}>
        <ul className={styles.cardList}>{transactionList.map(renderCard)}</ul>
      </div>
    );
  }

  const dateGroupList = groupTransactionListByDate(transactionList);

  return (
    <div className={styles.list}>
      {dateGroupList.map((group, groupIndex) => (
        <section key={`${group.date}-${String(groupIndex)}`} className={styles.dateGroup}>
          <div className={styles.dateHeader}>
            <Typography variant="body-s" fontWeight="semibold">
              {formatTransactionDate(group.date, locale)}
            </Typography>
          </div>
          <ul className={styles.cardList}>{group.transactionList.map(renderCard)}</ul>
        </section>
      ))}
    </div>
  );
};
