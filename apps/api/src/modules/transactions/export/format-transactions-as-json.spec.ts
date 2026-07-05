import { describe, expect, it } from 'vitest';

import type { TransactionExportRow } from './transaction-export-row';

import { formatTransactionsAsJson } from './format-transactions-as-json';

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

describe('formatTransactionsAsJson', () => {
  it('emits an empty array for no rows', () => {
    expect(formatTransactionsAsJson([])).toBe('[]');
  });

  it('emits a top-level array of objects with the export field set', () => {
    const parsed: unknown = JSON.parse(formatTransactionsAsJson([buildRow()]));

    expect(parsed).toEqual([
      {
        Date: '2025-02-03',
        Category: 'Food',
        Subcategory: 'Groceries',
        Type: 'Expense',
        Amount: '1234.56',
        Currency: 'UAH',
        Note: 'Lunch',
      },
    ]);
  });

  it('keeps amounts as quoted JSON strings, never numbers', () => {
    const actual = formatTransactionsAsJson([buildRow({ Amount: '1000000.00' })]);

    expect(actual).toContain('"Amount":"1000000.00"');
  });

  it('does not prepend a BOM', () => {
    expect(formatTransactionsAsJson([buildRow()]).startsWith('﻿')).toBe(false);
  });
});
