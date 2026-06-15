import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type {
  SortOrder,
  TransactionResponseDto,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';
import { Badge } from '@supertool/ui/src/components/atoms/badge/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@supertool/ui/src/components/molecules/table/Table';

import { formatTransactionAmount } from '../../utils/format-transaction-amount';
import { formatTransactionDate } from '../../utils/format-transaction-date';
import { TransactionRowActions } from '../transaction-row-actions/TransactionRowActions';
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

const getCategoryLabel = (transaction: TransactionResponseDto): string =>
  transaction.categoryParentName === null
    ? transaction.categoryName
    : `${transaction.categoryParentName} / ${transaction.categoryName}`;

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

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{translate('columns.date')}</TableHeaderCell>
          <TableHeaderCell>{translate('columns.category')}</TableHeaderCell>
          <TableHeaderCell>{translate('columns.type')}</TableHeaderCell>
          <TableHeaderCell className={styles.amountColumn}>
            {translate('columns.amount')}
          </TableHeaderCell>
          <TableHeaderCell>{translate('columns.currency')}</TableHeaderCell>
          <TableHeaderCell>{translate('columns.note')}</TableHeaderCell>
          <TableHeaderCell className={styles.actionsColumn}>
            {translate('columns.actions')}
          </TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {transactionList.map((transaction) => {
          const formattedDate = formatTransactionDate(transaction.date, locale);
          const formattedAmount = formatTransactionAmount(
            transaction.amount,
            transaction.currency,
            locale,
          );

          return (
            <TableRow key={transaction.id}>
              <TableCell className={styles.dateCell}>{formattedDate}</TableCell>
              <TableCell>{getCategoryLabel(transaction)}</TableCell>
              <TableCell>
                <Badge variant={transaction.type === 'income' ? 'success' : 'secondary'}>
                  {translate(`type.${transaction.type}`)}
                </Badge>
              </TableCell>
              <TableCell className={styles.amountColumn}>{formattedAmount}</TableCell>
              <TableCell>{transaction.currency}</TableCell>
              <TableCell className={styles.noteCell}>{transaction.note}</TableCell>
              <TableCell className={styles.actionsColumn}>
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
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
