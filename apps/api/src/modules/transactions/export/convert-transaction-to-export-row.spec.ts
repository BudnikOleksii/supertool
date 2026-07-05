import { describe, expect, it } from 'vitest';

import type { TransactionResponseDto } from '../dtos/transaction-response.dto';

import { convertTransactionToExportRow } from './convert-transaction-to-export-row';

const buildTransaction = (
  overrides: Partial<TransactionResponseDto> = {},
): TransactionResponseDto => ({
  id: 'transaction-1',
  date: '2025-02-03',
  type: 'expense',
  amount: '1234.56',
  currency: 'UAH',
  note: 'Lunch',
  categoryId: 'category-1',
  categoryName: 'Food',
  categoryParentName: null,
  createdAt: '2025-02-03T00:00:00.000Z',
  updatedAt: '2025-02-03T00:00:00.000Z',
  ...overrides,
});

describe('convertTransactionToExportRow', () => {
  it('maps a top-level category to Category with an empty Subcategory', () => {
    const actual = convertTransactionToExportRow(
      buildTransaction({ categoryName: 'Salary', categoryParentName: null }),
    );

    expect(actual.Category).toBe('Salary');
    expect(actual.Subcategory).toBe('');
  });

  it('maps a child category to parent Category plus child Subcategory', () => {
    const actual = convertTransactionToExportRow(
      buildTransaction({ categoryName: 'Groceries', categoryParentName: 'Food' }),
    );

    expect(actual.Category).toBe('Food');
    expect(actual.Subcategory).toBe('Groceries');
  });

  it('maps the transaction type to a canonical capitalised label', () => {
    expect(convertTransactionToExportRow(buildTransaction({ type: 'expense' })).Type).toBe(
      'Expense',
    );
    expect(convertTransactionToExportRow(buildTransaction({ type: 'income' })).Type).toBe('Income');
  });

  it('emits the stored amount string verbatim without numeric coercion', () => {
    const actual = convertTransactionToExportRow(buildTransaction({ amount: '1000000.00' }));

    expect(actual.Amount).toBe('1000000.00');
  });

  it('emits the bare calendar date and currency and note verbatim', () => {
    const actual = convertTransactionToExportRow(
      buildTransaction({ date: '2024-12-31', currency: 'USD', note: '' }),
    );

    expect(actual.Date).toBe('2024-12-31');
    expect(actual.Currency).toBe('USD');
    expect(actual.Note).toBe('');
  });
});
