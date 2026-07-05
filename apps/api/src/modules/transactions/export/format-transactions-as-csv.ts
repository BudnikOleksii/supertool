import type { TransactionExportRow } from './transaction-export-row';

import { EXPORT_COLUMN_LIST } from './transaction-export-row';

const UTF8_BOM = '﻿';
const ROW_SEPARATOR = '\r\n';
const FIELD_SEPARATOR = ',';
const QUOTE = '"';
const ESCAPED_QUOTE = '""';
const INJECTION_GUARD = "'";
const FIRST_CHARACTER_INDEX = 0;

const INJECTION_TRIGGER_SET = new Set(['=', '+', '-', '@', '\t', '\r']);
const QUOTING_TRIGGER_LIST = [QUOTE, FIELD_SEPARATOR, '\r', '\n'];

const checkNeedsInjectionGuard = (field: string): boolean =>
  INJECTION_TRIGGER_SET.has(field.charAt(FIRST_CHARACTER_INDEX));

const checkNeedsQuoting = (field: string): boolean =>
  QUOTING_TRIGGER_LIST.some((trigger) => field.includes(trigger));

export const escapeCsvField = (field: string): string => {
  const guarded = checkNeedsInjectionGuard(field) ? `${INJECTION_GUARD}${field}` : field;

  if (!checkNeedsQuoting(guarded)) {
    return guarded;
  }

  return `${QUOTE}${guarded.split(QUOTE).join(ESCAPED_QUOTE)}${QUOTE}`;
};

const formatRow = (fieldList: readonly string[]): string =>
  fieldList.map(escapeCsvField).join(FIELD_SEPARATOR);

export const formatTransactionsAsCsv = (rowList: readonly TransactionExportRow[]): string => {
  const headerRow = formatRow(EXPORT_COLUMN_LIST);
  const recordRowList = rowList.map((row) =>
    formatRow(EXPORT_COLUMN_LIST.map((column) => row[column])),
  );

  return `${UTF8_BOM}${[headerRow, ...recordRowList].join(ROW_SEPARATOR)}${ROW_SEPARATOR}`;
};
