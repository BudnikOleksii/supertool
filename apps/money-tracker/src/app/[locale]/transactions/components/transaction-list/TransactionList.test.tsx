import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  TransactionResponseDto,
  TransactionSortBy,
} from '@supertool/shared/generated/types.gen';

import { formatAmount } from '../../../../../utils/format-amount';
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
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props} href="#test">
      {children}
    </a>
  ),
}));

vi.mock('../../../../../components/bulk-delete/TransactionSelectCheckbox', () => ({
  TransactionSelectCheckbox: ({ label }: { id: string; label: string }) => (
    <input type="checkbox" aria-label={label} />
  ),
}));

const LOCALE = 'en-US';
const PERIOD = '2025-02';
const PAGE = 1;

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

const renderList = async (
  transactionList: TransactionResponseDto[],
  sortBy: TransactionSortBy = 'date',
): Promise<void> => {
  const renderTransactionList = TransactionList;
  render(
    await renderTransactionList({
      transactionList,
      locale: LOCALE,
      period: PERIOD,
      page: PAGE,
      sortBy,
      sortOrder: 'desc',
    }),
  );
};

describe('TransactionList', () => {
  it('renders a card per transaction with parent/child category and formatted amount', async () => {
    await renderList([buildTransaction({})]);

    expect(screen.getByText('Food / Groceries')).toBeTruthy();
    expect(screen.getByText(formatAmount('1234.56', 'USD', LOCALE))).toBeTruthy();
  });

  it('renders a bare category name when the transaction has no parent category', async () => {
    await renderList([
      buildTransaction({ id: 'transaction-2', categoryName: 'Salary', categoryParentName: null }),
    ]);

    expect(screen.getByText('Salary')).toBeTruthy();
  });

  it('groups transactions under a formatted date header', async () => {
    const transactionList = [
      buildTransaction({ id: 'transaction-1', date: '2025-02-03' }),
      buildTransaction({ id: 'transaction-2', date: '2025-02-03' }),
      buildTransaction({ id: 'transaction-3', date: '2025-02-02' }),
    ];

    await renderList(transactionList);

    expect(screen.getByText(formatTransactionDate('2025-02-03', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatTransactionDate('2025-02-02', LOCALE))).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(transactionList.length);
  });

  it('renders a flat list with no date headers when sorted by amount', async () => {
    const transactionList = [
      buildTransaction({ id: 'transaction-1', date: '2025-02-03', amount: '900.00' }),
      buildTransaction({ id: 'transaction-2', date: '2025-02-02', amount: '500.00' }),
      buildTransaction({ id: 'transaction-3', date: '2025-02-03', amount: '100.00' }),
    ];

    await renderList(transactionList, 'amount');

    expect(screen.queryByText(formatTransactionDate('2025-02-03', LOCALE))).toBeNull();
    expect(screen.queryByText(formatTransactionDate('2025-02-02', LOCALE))).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(transactionList.length);
  });

  it('exposes always-visible duplicate, edit and delete controls per card (touch reachability)', async () => {
    const transactionList = [
      buildTransaction({ id: 'transaction-1' }),
      buildTransaction({ id: 'transaction-2', categoryParentName: null, categoryName: 'Salary' }),
    ];

    await renderList(transactionList);

    expect(screen.getAllByRole('link', { name: 'actions.copy' })).toHaveLength(
      transactionList.length,
    );
    expect(screen.getAllByRole('link', { name: 'actions.edit' })).toHaveLength(
      transactionList.length,
    );
    expect(screen.getAllByRole('button', { name: 'actions.delete' })).toHaveLength(
      transactionList.length,
    );
  });
});
