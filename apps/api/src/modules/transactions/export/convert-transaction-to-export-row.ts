import type { TransactionResponseDto } from '../dtos/transaction-response.dto';
import type { TransactionExportRow } from './transaction-export-row';

const CANONICAL_TYPE_LABEL: Readonly<Record<TransactionResponseDto['type'], string>> = {
  expense: 'Expense',
  income: 'Income',
};

export const convertTransactionToExportRow = (
  row: TransactionResponseDto,
): TransactionExportRow => {
  const hasParent = row.categoryParentName !== null;

  return {
    Date: row.date,
    Category: hasParent ? (row.categoryParentName ?? '') : row.categoryName,
    Subcategory: hasParent ? row.categoryName : '',
    Type: CANONICAL_TYPE_LABEL[row.type],
    Amount: row.amount,
    Currency: row.currency,
    Note: row.note,
  };
};
