import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ByCategoryNodeDto } from '@supertool/shared/generated/types.gen';

import { fetchTransactionsByCategory } from '../../../../../../actions/fetch-transactions-by-category';
import { formatAmount } from '../../../../../../utils/format-amount';
import { ByCategoryAccordion } from './ByCategoryAccordion';

vi.mock('next-intl/server', () => ({
  getTranslations: async () =>
    Object.assign(
      (key: string, values?: Record<string, unknown>) =>
        values && 'count' in values ? `count:${String(values.count)}` : key,
      { has: () => true },
    ),
}));

vi.mock('./ByCategoryAccordion.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
}));

vi.mock('../../../../../../actions/fetch-transactions-by-category', () => ({
  fetchTransactionsByCategory: vi.fn(),
}));

const fetchTransactionsByCategoryMock = vi.mocked(fetchTransactionsByCategory);

const LOCALE = 'en';
const PROPS = { dateFrom: '2025-02-01', dateTo: '2025-02-28', period: '2025-02', locale: LOCALE };

const renderAccordion = ByCategoryAccordion;

const buildNode = (over: Partial<ByCategoryNodeDto>): ByCategoryNodeDto => ({
  categoryId: 'id',
  categoryName: 'Name',
  parentId: null,
  type: 'expense',
  total: '0.00',
  transactionCount: 0,
  ...over,
});

const CATEGORY_LIST: ByCategoryNodeDto[] = [
  buildNode({ categoryId: 'p1', categoryName: 'Food', total: '420.00', transactionCount: 12 }),
  buildNode({
    categoryId: 'c1',
    categoryName: 'Restaurants',
    parentId: 'p1',
    total: '120.00',
    transactionCount: 4,
  }),
  buildNode({
    categoryId: 'i1',
    categoryName: 'Salary',
    type: 'income',
    total: '3000.00',
    transactionCount: 1,
  }),
];

describe('ByCategoryAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each top-level category with its formatted total and count', async () => {
    fetchTransactionsByCategoryMock.mockResolvedValue({
      status: 'success',
      byCategory: { categories: CATEGORY_LIST, currency: 'USD' },
    });

    render(await renderAccordion(PROPS));

    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Salary')).toBeTruthy();
    expect(screen.getByText(formatAmount('420.00', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatAmount('3000.00', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText('count:12')).toBeTruthy();
  });

  it('reveals child categories with their own totals when a parent is expanded', async () => {
    fetchTransactionsByCategoryMock.mockResolvedValue({
      status: 'success',
      byCategory: { categories: CATEGORY_LIST, currency: 'USD' },
    });

    render(await renderAccordion(PROPS));

    fireEvent.click(screen.getByRole('button', { name: /Food/u }));

    expect(screen.getByText('Restaurants')).toBeTruthy();
    expect(screen.getByText(formatAmount('120.00', 'USD', LOCALE))).toBeTruthy();
  });

  it('renders the empty state when there are no categories', async () => {
    fetchTransactionsByCategoryMock.mockResolvedValue({
      status: 'success',
      byCategory: { categories: [], currency: 'USD' },
    });

    render(await renderAccordion(PROPS));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the empty state when the user has no default currency', async () => {
    fetchTransactionsByCategoryMock.mockResolvedValue({
      status: 'success',
      byCategory: { categories: CATEGORY_LIST, currency: '' },
    });

    render(await renderAccordion(PROPS));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the request fails', async () => {
    fetchTransactionsByCategoryMock.mockResolvedValue({ status: 'error' });

    render(await renderAccordion(PROPS));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
