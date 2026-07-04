import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchTransactions } from '../../../../../actions/fetch-transactions';
import { formatAmount } from '../../../../../utils/format-amount';
import { DashboardRecentTransactions } from './DashboardRecentTransactions';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('./DashboardRecentTransactions.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ href, children }: ComponentProps<'a'>) => <a href={String(href)}>{children}</a>,
}));

vi.mock('../../../../../actions/fetch-transactions', () => ({
  fetchTransactions: vi.fn(),
}));

const fetchTransactionsMock = vi.mocked(fetchTransactions);

const renderWidget = DashboardRecentTransactions;

const LOCALE = 'en';
const RANGE = { dateFrom: '2025-02-01', dateTo: '2025-02-28', locale: LOCALE };

const TIMESTAMP = '2025-02-03T00:00:00.000Z';

const buildTransaction = (
  overrides: Partial<TransactionResponseDto> = {},
): TransactionResponseDto => ({
  id: 'tx-1',
  date: '2025-02-03',
  type: 'expense',
  amount: '42.00',
  currency: 'USD',
  note: '',
  categoryId: 'cat-1',
  categoryName: 'Groceries',
  categoryParentName: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
});

describe('DashboardRecentTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the latest rows for the range and forwards the type filter', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: { data: [buildTransaction()], meta: { page: 1, limit: 5, total: 1 } },
    });

    render(await renderWidget({ ...RANGE, type: 'expense' }));

    expect(fetchTransactionsMock).toHaveBeenCalledWith({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: 'expense',
      page: 1,
      limit: 5,
      sortBy: 'date',
      sortOrder: 'desc',
    });
  });

  it('renders each transaction with its formatted amount and category label', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: {
        data: [
          buildTransaction(),
          buildTransaction({
            id: 'tx-2',
            type: 'income',
            amount: '900.00',
            categoryName: 'Salary',
            categoryParentName: 'Work',
          }),
        ],
        meta: { page: 1, limit: 5, total: 2 },
      },
    });

    render(await renderWidget(RANGE));

    expect(screen.getByText(formatAmount('42.00', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByText('Work / Salary')).toBeTruthy();
    expect(screen.getByText('typeIncome')).toBeTruthy();
    expect(screen.getByText('typeExpense')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'viewAll' }).getAttribute('href')).toBe(
      '/transactions',
    );
  });

  it('renders the empty state when there are no transactions', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: { data: [], meta: { page: 1, limit: 5, total: 0 } },
    });

    render(await renderWidget(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the request fails', async () => {
    fetchTransactionsMock.mockResolvedValue({ status: 'error' });

    render(await renderWidget(RANGE));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
