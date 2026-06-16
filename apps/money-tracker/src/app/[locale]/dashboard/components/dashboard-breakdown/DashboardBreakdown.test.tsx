import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCategoryBreakdown } from '../../../../../actions/fetch-category-breakdown';
import { formatAmount } from '../../../../../utils/format-amount';
import { DashboardBreakdown } from './DashboardBreakdown';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('./DashboardBreakdown.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('../../../../../actions/fetch-category-breakdown', () => ({
  fetchCategoryBreakdown: vi.fn(),
}));

const fetchCategoryBreakdownMock = vi.mocked(fetchCategoryBreakdown);

const renderDashboardBreakdown = DashboardBreakdown;

const LOCALE = 'en';
const PERIOD = '2025-02';

describe('DashboardBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the categories ordered by amount with formatted totals', async () => {
    fetchCategoryBreakdownMock.mockResolvedValue({
      status: 'success',
      breakdown: {
        breakdown: [
          { categoryId: 'cat-1', categoryName: 'Groceries', total: '420.00', share: 70 },
          { categoryId: 'cat-2', categoryName: 'Transport', total: '180.00', share: 30 },
        ],
        totalExpense: '600.00',
        currency: 'USD',
      },
    });

    const { container } = render(
      await renderDashboardBreakdown({ period: PERIOD, locale: LOCALE }),
    );

    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByText('Transport')).toBeTruthy();
    expect(screen.getByText(formatAmount('420.00', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatAmount('180.00', 'USD', LOCALE))).toBeTruthy();

    const nameList = [...container.querySelectorAll('.name')].map((node) => node.textContent);
    expect(nameList).toEqual(['Groceries', 'Transport']);
  });

  it('reflects each share as the bar fill width custom property', async () => {
    fetchCategoryBreakdownMock.mockResolvedValue({
      status: 'success',
      breakdown: {
        breakdown: [
          { categoryId: 'cat-1', categoryName: 'Groceries', total: '420.00', share: 70 },
          { categoryId: 'cat-2', categoryName: 'Transport', total: '180.00', share: 30 },
        ],
        totalExpense: '600.00',
        currency: 'USD',
      },
    });

    const { container } = render(
      await renderDashboardBreakdown({ period: PERIOD, locale: LOCALE }),
    );

    const barWidthList = [...container.querySelectorAll<HTMLElement>('.barFill')].map((node) =>
      node.style.getPropertyValue('--bar-width'),
    );
    expect(barWidthList).toEqual(['70%', '30%']);
  });

  it('renders the empty state when there are no expenses', async () => {
    fetchCategoryBreakdownMock.mockResolvedValue({
      status: 'success',
      breakdown: { breakdown: [], totalExpense: '0.00', currency: 'USD' },
    });

    render(await renderDashboardBreakdown({ period: PERIOD, locale: LOCALE }));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the empty state when the user has no default currency', async () => {
    fetchCategoryBreakdownMock.mockResolvedValue({
      status: 'success',
      breakdown: { breakdown: [], totalExpense: '0.00', currency: '' },
    });

    render(await renderDashboardBreakdown({ period: PERIOD, locale: LOCALE }));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the breakdown request fails', async () => {
    fetchCategoryBreakdownMock.mockResolvedValue({ status: 'error' });

    render(await renderDashboardBreakdown({ period: PERIOD, locale: LOCALE }));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
