import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTopCategories } from '../../../../../actions/fetch-top-categories';
import { formatAmount } from '../../../../../utils/format-amount';
import { DashboardTopCategories } from './DashboardTopCategories';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('./DashboardTopCategories.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('../../../../../actions/fetch-top-categories', () => ({
  fetchTopCategories: vi.fn(),
}));

const fetchTopCategoriesMock = vi.mocked(fetchTopCategories);

const renderWidget = DashboardTopCategories;

const LOCALE = 'en';
const RANGE = { dateFrom: '2025-02-01', dateTo: '2025-02-28', locale: LOCALE };

describe('DashboardTopCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each ranked category with its formatted total and share', async () => {
    fetchTopCategoriesMock.mockResolvedValue({
      status: 'success',
      topCategories: {
        categories: [
          {
            rank: 1,
            categoryId: 'cat-1',
            categoryName: 'Groceries',
            total: '420.00',
            share: 70,
            transactionCount: 12,
          },
          {
            rank: 2,
            categoryId: 'cat-2',
            categoryName: 'Transport',
            total: '180.00',
            share: 30,
            transactionCount: 4,
          },
        ],
        totalExpense: '600.00',
        currency: 'USD',
      },
    });

    const { container } = render(await renderWidget(RANGE));

    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByText('Transport')).toBeTruthy();
    expect(screen.getByText(formatAmount('420.00', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatAmount('180.00', 'USD', LOCALE))).toBeTruthy();

    const nameList = [...container.querySelectorAll('.name')].map((node) => node.textContent);
    expect(nameList).toEqual(['Groceries', 'Transport']);
  });

  it('reflects each share as the bar fill width custom property', async () => {
    fetchTopCategoriesMock.mockResolvedValue({
      status: 'success',
      topCategories: {
        categories: [
          {
            rank: 1,
            categoryId: 'cat-1',
            categoryName: 'Groceries',
            total: '420.00',
            share: 70,
            transactionCount: 12,
          },
          {
            rank: 2,
            categoryId: 'cat-2',
            categoryName: 'Transport',
            total: '180.00',
            share: 30,
            transactionCount: 4,
          },
        ],
        totalExpense: '600.00',
        currency: 'USD',
      },
    });

    const { container } = render(await renderWidget(RANGE));

    const barWidthList = [...container.querySelectorAll<HTMLElement>('.barFill')].map((node) =>
      node.style.getPropertyValue('--bar-width'),
    );
    expect(barWidthList).toEqual(['70%', '30%']);
  });

  it('renders the empty state when there are no categories', async () => {
    fetchTopCategoriesMock.mockResolvedValue({
      status: 'success',
      topCategories: { categories: [], totalExpense: '0.00', currency: 'USD' },
    });

    render(await renderWidget(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the empty state when the user has no default currency', async () => {
    fetchTopCategoriesMock.mockResolvedValue({
      status: 'success',
      topCategories: {
        categories: [
          {
            rank: 1,
            categoryId: 'cat-1',
            categoryName: 'Groceries',
            total: '1.00',
            share: 100,
            transactionCount: 1,
          },
        ],
        totalExpense: '1.00',
        currency: '',
      },
    });

    render(await renderWidget(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the request fails', async () => {
    fetchTopCategoriesMock.mockResolvedValue({ status: 'error' });

    render(await renderWidget(RANGE));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
