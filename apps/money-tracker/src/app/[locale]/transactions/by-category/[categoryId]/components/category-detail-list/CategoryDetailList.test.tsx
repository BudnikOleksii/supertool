import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchTransactions } from '../../../../../../../actions/fetch-transactions';
import { formatAmount } from '../../../../../../../utils/format-amount';
import { CategoryDetailList } from './CategoryDetailList';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('./CategoryDetailList.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('../../../../../../../actions/fetch-transactions', () => ({
  fetchTransactions: vi.fn(),
}));

vi.mock('../../../../components/transaction-pagination/TransactionPagination', () => ({
  TransactionPagination: () => null,
}));

vi.mock('../../../../../../../components/bulk-delete/BulkDeleteProvider', () => ({
  BulkDeleteProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../../../../../../../components/bulk-delete/TransactionSelectCheckbox', () => ({
  TransactionSelectCheckbox: ({ label }: { id: string; label: string }) => (
    <input type="checkbox" aria-label={label} />
  ),
}));

const fetchTransactionsMock = vi.mocked(fetchTransactions);
const redirectMock = vi.mocked(redirect);

const renderList = CategoryDetailList;

const LOCALE = 'en';
const PERIOD = '2025-02';
const PROPS = {
  dateFrom: '2025-02-01',
  dateTo: '2025-02-28',
  period: PERIOD,
  categoryId: 'cat-1',
  page: 1,
  locale: LOCALE,
};

const buildTransaction = (over: Partial<TransactionResponseDto>): TransactionResponseDto => ({
  id: 'id',
  date: '2025-02-03',
  type: 'expense',
  amount: '12.00',
  currency: 'USD',
  note: '',
  categoryId: 'cat-1',
  categoryName: 'Restaurants',
  categoryParentName: 'Food',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('CategoryDetailList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each transaction with its formatted amount and category label', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: {
        data: [buildTransaction({ id: 't1', amount: '45.99', currency: 'USD' })],
        meta: { page: 1, limit: 50, total: 1 },
      },
    });

    render(await renderList(PROPS));

    expect(screen.getByText(formatAmount('45.99', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText('Food / Restaurants')).toBeTruthy();
  });

  it('renders the empty state when the category has no transactions', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: { data: [], meta: { page: 1, limit: 50, total: 0 } },
    });

    render(await renderList(PROPS));

    expect(screen.getByText('detail.empty.title')).toBeTruthy();
  });

  it('redirects to the last valid page when the requested page is out of range', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: { data: [], meta: { page: 3, limit: 50, total: 60 } },
    });

    await renderList({ ...PROPS, page: 3 });

    expect(redirectMock).toHaveBeenCalledWith({
      href: {
        pathname: '/transactions/by-category/cat-1',
        query: { period: PERIOD, page: '2' },
      },
      locale: LOCALE,
    });
  });

  it('redirects to page one when the requested page is out of range and only one page remains', async () => {
    fetchTransactionsMock.mockResolvedValue({
      status: 'success',
      transactions: { data: [], meta: { page: 2, limit: 50, total: 50 } },
    });

    await renderList({ ...PROPS, page: 2 });

    expect(redirectMock).toHaveBeenCalledWith({
      href: {
        pathname: '/transactions/by-category/cat-1',
        query: { period: PERIOD },
      },
      locale: LOCALE,
    });
  });

  it('renders the error state when the request fails', async () => {
    fetchTransactionsMock.mockResolvedValue({ status: 'error' });

    render(await renderList(PROPS));

    expect(screen.getByText('detail.error.title')).toBeTruthy();
  });
});
