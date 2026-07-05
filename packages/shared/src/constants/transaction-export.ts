import type { ObjectValuesUnion } from '../types/object-values-union';

export const TRANSACTION_EXPORT_FORMAT = {
  csv: 'csv',
  json: 'json',
} as const;

export type TransactionExportFormat = ObjectValuesUnion<typeof TRANSACTION_EXPORT_FORMAT>;

export const TRANSACTION_EXPORT_FORMAT_LIST = Object.values(TRANSACTION_EXPORT_FORMAT);

export const DEFAULT_TRANSACTION_EXPORT_FORMAT: TransactionExportFormat =
  TRANSACTION_EXPORT_FORMAT.csv;

export const MAX_EXPORT_ROWS = 10_000;

export const EXPORT_TRUNCATED_HEADER = 'X-Result-Truncated';
