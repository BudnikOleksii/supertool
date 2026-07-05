export interface TransactionExportRow {
  Date: string;
  Category: string;
  Subcategory: string;
  Type: string;
  Amount: string;
  Currency: string;
  Note: string;
}

export const EXPORT_COLUMN_LIST: readonly (keyof TransactionExportRow)[] = [
  'Date',
  'Category',
  'Subcategory',
  'Type',
  'Amount',
  'Currency',
  'Note',
];
