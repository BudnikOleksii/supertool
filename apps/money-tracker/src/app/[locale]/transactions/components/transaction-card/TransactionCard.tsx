import type { FC } from 'react';

import type {
  SortOrder,
  TransactionResponseDto,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';
import { Badge } from '@supertool/ui/src/components/atoms/badge/Badge';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { formatAmount } from '../../../../../utils/format-amount';
import { formatTransactionDate } from '../../utils/format-transaction-date';
import { getCategoryLabel } from '../../utils/get-category-label';
import { TransactionRowActions } from '../transaction-row-actions/TransactionRowActions';
import styles from './TransactionCard.module.scss';

interface Props {
  transaction: TransactionResponseDto;
  locale: string;
  typeLabel: string;
  period: string;
  page: number;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
}

export const TransactionCard: FC<Props> = ({
  transaction,
  locale,
  typeLabel,
  period,
  page,
  type,
  categoryId,
  sortBy,
  sortOrder,
}) => {
  const formattedDate = formatTransactionDate(transaction.date, locale);
  const formattedAmount = formatAmount(transaction.amount, transaction.currency, locale);

  return (
    <li className={styles.card}>
      <div className={styles.info}>
        <div className={styles.primary}>
          <Typography variant="body-m" fontWeight="semibold" className={styles.amount}>
            {formattedAmount}
          </Typography>
          <Badge variant={transaction.type === 'income' ? 'success' : 'secondary'}>
            {typeLabel}
          </Badge>
        </div>
        <div className={styles.secondary}>
          <Typography variant="body-s" className={styles.category}>
            {getCategoryLabel(transaction)}
          </Typography>
          {transaction.note.trim() !== '' && (
            <Typography variant="body-s" className={styles.note}>
              {transaction.note}
            </Typography>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        <TransactionRowActions
          id={transaction.id}
          period={period}
          page={page}
          type={type}
          categoryId={categoryId}
          sortBy={sortBy}
          sortOrder={sortOrder}
          formattedAmount={formattedAmount}
          formattedDate={formattedDate}
        />
      </div>
    </li>
  );
};
