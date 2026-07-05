import type { TransactionExportFormat } from '@supertool/shared/constants/transaction-export';

const ISO_DATE_END_INDEX = 10;

export interface ExportFilenameFilters {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

const getCurrentIsoDate = (): string => new Date().toISOString().slice(0, ISO_DATE_END_INDEX);

export const buildExportFilename = (
  format: TransactionExportFormat,
  filters: ExportFilenameFilters,
  today: string = getCurrentIsoDate(),
): string => {
  if (filters.dateFrom !== undefined && filters.dateTo !== undefined) {
    return `transactions-${filters.dateFrom}_${filters.dateTo}.${format}`;
  }

  return `transactions-${today}.${format}`;
};
