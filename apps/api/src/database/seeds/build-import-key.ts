import { createHash } from 'node:crypto';

import type { SeedSourceRecord } from './seed.types';

import { convertAmountToString } from './convert-amount';
import { normalizeTransactionType } from './normalize-transaction-type';
import { parseSeedDate } from './parse-seed-date';

const FIELD_SEPARATOR = '\u001f';

interface BuildImportKeyOptions {
  record: SeedSourceRecord;
  rowIndex: number;
}

export const buildImportKey = ({ record, rowIndex }: BuildImportKeyOptions): string => {
  const fieldList = [
    parseSeedDate(record.Date),
    record.Category,
    record.Subcategory ?? '',
    normalizeTransactionType(record.Type),
    convertAmountToString(record.Amount),
    record.Currency,
    String(rowIndex),
  ];

  return createHash('sha256').update(fieldList.join(FIELD_SEPARATOR)).digest('hex');
};
