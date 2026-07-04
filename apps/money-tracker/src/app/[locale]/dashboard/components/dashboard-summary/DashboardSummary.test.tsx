import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMonthlySummary } from '../../../../../actions/fetch-monthly-summary';
import { formatAmount } from '../../../../../utils/format-amount';
import { DashboardSummary } from './DashboardSummary';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('./DashboardSummary.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('../../../../../actions/fetch-monthly-summary', () => ({
  fetchMonthlySummary: vi.fn(),
}));

const fetchMonthlySummaryMock = vi.mocked(fetchMonthlySummary);

const renderDashboardSummary = DashboardSummary;

const LOCALE = 'en';
const DATE_FROM = '2025-02-01';
const DATE_TO = '2025-02-28';
const RANGE = { dateFrom: DATE_FROM, dateTo: DATE_TO, locale: LOCALE };

describe('DashboardSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders income, expense and net formatted in the default currency', async () => {
    fetchMonthlySummaryMock.mockResolvedValue({
      status: 'success',
      summary: { income: '300.00', expense: '120.50', net: '179.50', currency: 'USD' },
    });

    render(await renderDashboardSummary(RANGE));

    expect(screen.getByText(formatAmount('300.00', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatAmount('120.50', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText(formatAmount('179.50', 'USD', LOCALE))).toBeTruthy();
  });

  it('renders a negative net with the deficit (expense) styling', async () => {
    fetchMonthlySummaryMock.mockResolvedValue({
      status: 'success',
      summary: { income: '100.00', expense: '142.50', net: '-42.50', currency: 'USD' },
    });

    render(await renderDashboardSummary(RANGE));

    const netElement = screen.getByText(formatAmount('-42.50', 'USD', LOCALE));

    expect(netElement.className).toContain('expense');
  });

  it('renders a positive net with the surplus (income) styling', async () => {
    fetchMonthlySummaryMock.mockResolvedValue({
      status: 'success',
      summary: { income: '300.00', expense: '120.50', net: '179.50', currency: 'USD' },
    });

    render(await renderDashboardSummary(RANGE));

    const netElement = screen.getByText(formatAmount('179.50', 'USD', LOCALE));

    expect(netElement.className).toContain('income');
  });

  it('renders the empty state when the user has no default currency', async () => {
    fetchMonthlySummaryMock.mockResolvedValue({
      status: 'success',
      summary: { income: '0.00', expense: '0.00', net: '0.00', currency: '' },
    });

    render(await renderDashboardSummary(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the empty state when the month has no activity', async () => {
    fetchMonthlySummaryMock.mockResolvedValue({
      status: 'success',
      summary: { income: '0.00', expense: '0.00', net: '0.00', currency: 'USD' },
    });

    render(await renderDashboardSummary(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the summary request fails', async () => {
    fetchMonthlySummaryMock.mockResolvedValue({ status: 'error' });

    render(await renderDashboardSummary(RANGE));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
