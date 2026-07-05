import type { TransactionExportRow } from './transaction-export-row';

export const formatTransactionsAsJson = (rowList: readonly TransactionExportRow[]): string =>
  JSON.stringify(rowList);
