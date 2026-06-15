import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

import { formatTransactionAmount } from '../../utils/format-transaction-amount';
import { formatTransactionDate } from '../../utils/format-transaction-date';
import { TransactionList } from './TransactionList';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
}));

const LOCALE = 'en-US';
const PERIOD = '2025-02';
const PAGE = 1;
const HEADER_ROW_COUNT = 1;

const buildTransaction = (overrides: Partial<TransactionResponseDto>): TransactionResponseDto => ({
  id: 'transaction-1',
  date: '2025-02-03',
  type: 'expense',
  amount: '1234.56',
  currency: 'USD',
  note: 'Groceries run',
  categoryId: 'category-1',
  categoryName: 'Groceries',
  categoryParentName: 'Food',
  createdAt: '2025-02-03T00:00:00.000Z',
  updatedAt: '2025-02-03T00:00:00.000Z',
  ...overrides,
});

describe('TransactionList', () => {
  it('renders a parent/child category label and formatted amount and date', async () => {
    const transactionList = [buildTransaction({})];

    const renderTransactionList = TransactionList;
    render(
      await renderTransactionList({
        transactionList,
        locale: LOCALE,
        period: PERIOD,
        page: PAGE,
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    );

    expect(screen.getByText('Food / Groceries')).toBeTruthy();
    expect(screen.getByText(formatTransactionAmount('1234.56', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatTransactionDate('2025-02-03', LOCALE))).toBeTruthy();
  });

  it('renders a bare category name when the transaction has no parent category', async () => {
    const transactionList = [
      buildTransaction({ id: 'transaction-2', categoryName: 'Salary', categoryParentName: null }),
    ];

    const renderTransactionList = TransactionList;
    render(
      await renderTransactionList({
        transactionList,
        locale: LOCALE,
        period: PERIOD,
        page: PAGE,
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    );

    expect(screen.getByText('Salary')).toBeTruthy();
  });

  it('renders one row per transaction', async () => {
    const transactionList = [
      buildTransaction({ id: 'transaction-1' }),
      buildTransaction({ id: 'transaction-2', categoryParentName: null, categoryName: 'Salary' }),
    ];

    const renderTransactionList = TransactionList;
    render(
      await renderTransactionList({
        transactionList,
        locale: LOCALE,
        period: PERIOD,
        page: PAGE,
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    );

    expect(screen.getAllByRole('row')).toHaveLength(transactionList.length + HEADER_ROW_COUNT);
  });
});
