import { describe, expect, it } from 'vitest';

import { transactionFormSchema } from './transaction-form-schema';

const FIRST_ISSUE_INDEX = 0;

const VALID_INPUT = {
  type: 'expense',
  amount: '12.5',
  currency: 'UAH',
  categoryId: 'category-id',
  date: '2025-02-03',
  note: '',
};

describe('transactionFormSchema', () => {
  it('normalizes a valid amount to a two-decimal string', () => {
    const actual = transactionFormSchema.safeParse(VALID_INPUT);

    expect(actual.success).toBe(true);
    expect(actual.data?.amount).toBe('12.50');
  });

  it('rejects a zero amount with the amountInvalid message key', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, amount: '0' });

    expect(actual.success).toBe(false);
    expect(actual.error?.issues[FIRST_ISSUE_INDEX]?.message).toBe('amountInvalid');
  });

  it('rejects a negative amount', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, amount: '-5.00' });

    expect(actual.success).toBe(false);
  });

  it('rejects an amount with more than two fraction digits', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, amount: '12.345' });

    expect(actual.success).toBe(false);
  });

  it('rejects an empty category', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, categoryId: '' });

    expect(actual.success).toBe(false);
  });

  it('rejects a malformed date', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, date: '03-02-2025' });

    expect(actual.success).toBe(false);
  });

  it('rejects a format-valid but non-existent calendar date', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, date: '2025-02-30' });

    expect(actual.success).toBe(false);
    expect(actual.error?.issues[FIRST_ISSUE_INDEX]?.message).toBe('dateInvalid');
  });

  it('trims a whitespace-only note to an empty string', () => {
    const actual = transactionFormSchema.safeParse({ ...VALID_INPUT, note: '   ' });

    expect(actual.success).toBe(true);
    expect(actual.data?.note).toBe('');
  });
});
