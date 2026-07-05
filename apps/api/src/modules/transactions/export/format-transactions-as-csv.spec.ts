import { describe, expect, it } from 'vitest';

import type { TransactionExportRow } from './transaction-export-row';

import { escapeCsvField, formatTransactionsAsCsv } from './format-transactions-as-csv';

const UTF8_BOM = '﻿';
const HEADER_ROW = 'Date,Category,Subcategory,Type,Amount,Currency,Note';

const buildRow = (overrides: Partial<TransactionExportRow> = {}): TransactionExportRow => ({
  Date: '2025-02-03',
  Category: 'Food',
  Subcategory: 'Groceries',
  Type: 'Expense',
  Amount: '1234.56',
  Currency: 'UAH',
  Note: 'Lunch',
  ...overrides,
});

describe('escapeCsvField', () => {
  it('leaves a plain field untouched', () => {
    expect(escapeCsvField('Food')).toBe('Food');
  });

  it('wraps a field containing a comma in double quotes', () => {
    expect(escapeCsvField('Food, drinks')).toBe('"Food, drinks"');
  });

  it('doubles embedded double quotes and wraps the field', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps a field containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps a field containing a carriage return', () => {
    expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"');
  });

  it('guards and quotes a field that begins with a carriage return', () => {
    expect(escapeCsvField('\rvalue')).toBe('"\'\rvalue"');
  });

  it('preserves Cyrillic and Unicode characters', () => {
    expect(escapeCsvField('Продукти')).toBe('Продукти');
  });

  it('leaves an empty field empty', () => {
    expect(escapeCsvField('')).toBe('');
  });
});

describe('escapeCsvField injection safety', () => {
  it('neutralises a leading equals sign', () => {
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
  });

  it('neutralises a leading plus sign', () => {
    expect(escapeCsvField('+1')).toBe("'+1");
  });

  it('neutralises a leading minus sign', () => {
    expect(escapeCsvField('-1')).toBe("'-1");
  });

  it('neutralises a leading at sign', () => {
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
  });

  it('neutralises a leading tab character', () => {
    expect(escapeCsvField('\tvalue')).toBe("'\tvalue");
  });

  it('neutralises injection and still quotes when a comma is present', () => {
    expect(escapeCsvField('=SUM(A1,A2)')).toBe('"\'=SUM(A1,A2)"');
  });
});

describe('formatTransactionsAsCsv', () => {
  it('prepends a UTF-8 BOM and emits the stable header row', () => {
    const actual = formatTransactionsAsCsv([]);

    expect(actual).toBe(`${UTF8_BOM}${HEADER_ROW}\r\n`);
  });

  it('emits one CRLF-terminated record per transaction in column order', () => {
    const actual = formatTransactionsAsCsv([buildRow()]);

    expect(actual).toBe(
      `${UTF8_BOM}${HEADER_ROW}\r\n2025-02-03,Food,Groceries,Expense,1234.56,UAH,Lunch\r\n`,
    );
  });

  it('keeps a large amount as an exact string with no grouping', () => {
    const actual = formatTransactionsAsCsv([buildRow({ Amount: '1000000.00' })]);

    expect(actual).toContain(',1000000.00,');
  });

  it('escapes a note containing quotes, commas and newlines', () => {
    const actual = formatTransactionsAsCsv([buildRow({ Note: 'a,"b"\nc' })]);

    expect(actual).toContain('"a,""b""\nc"');
  });
});
