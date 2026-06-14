import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';
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
import styles from './TransactionList.module.scss';

interface Props {
  transactionList: TransactionResponseDto[];
  locale: string;
}

const getCategoryLabel = (transaction: TransactionResponseDto): string =>
  transaction.categoryParentName === null
    ? transaction.categoryName
    : `${transaction.categoryParentName} / ${transaction.categoryName}`;

export const TransactionList: FC<Props> = async ({ transactionList, locale }) => {
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
        </TableRow>
      </TableHead>
      <TableBody>
        {transactionList.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className={styles.dateCell}>
              {formatTransactionDate(transaction.date, locale)}
            </TableCell>
            <TableCell>{getCategoryLabel(transaction)}</TableCell>
            <TableCell>
              <Badge variant={transaction.type === 'income' ? 'success' : 'secondary'}>
                {translate(`type.${transaction.type}`)}
              </Badge>
            </TableCell>
            <TableCell className={styles.amountColumn}>
              {formatTransactionAmount(transaction.amount, transaction.currency, locale)}
            </TableCell>
            <TableCell>{transaction.currency}</TableCell>
            <TableCell className={styles.noteCell}>{transaction.note}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
