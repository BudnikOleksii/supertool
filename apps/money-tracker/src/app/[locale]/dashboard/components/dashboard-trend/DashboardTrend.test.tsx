import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMonthlyTrend } from '../../../../../actions/fetch-monthly-trend';
import { DashboardTrend } from './DashboardTrend';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('./DashboardTrend.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('next/dynamic', () => ({
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- factory cannot reference module-scope (vi.mock is hoisted above declarations)
  default: () => (props: { chartData: { label: string }[] }) => (
    <div data-testid="chart">
      {props.chartData.map((datum) => (
        <span key={datum.label} data-testid="chart-label">
          {datum.label}
        </span>
      ))}
    </div>
  ),
}));

vi.mock('../../../../../actions/fetch-monthly-trend', () => ({
  fetchMonthlyTrend: vi.fn(),
}));

const fetchMonthlyTrendMock = vi.mocked(fetchMonthlyTrend);

const renderDashboardTrend = DashboardTrend;

const LOCALE = 'en';
const PERIOD = '2025-02';
const MONTH_COUNT = 12;
const FIRST_INDEX = 0;
const INDEX_TO_MONTH = 1;
const MONTH_PAD = 2;
const SAMPLE_YEAR = 2024;
const JANUARY_MONTH_INDEX = 0;
const FIRST_DAY_OF_MONTH = 1;

const buildTrendList = (
  firstIncome: string,
  firstExpense: string,
): { month: string; income: string; expense: string }[] =>
  [...Array(MONTH_COUNT).keys()].map((index) => ({
    month: `${SAMPLE_YEAR}-${String(index + INDEX_TO_MONTH).padStart(MONTH_PAD, '0')}`,
    income: index === FIRST_INDEX ? firstIncome : '0.00',
    expense: index === FIRST_INDEX ? firstExpense : '0.00',
  }));

const getMonthLabel = (locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(
    new Date(SAMPLE_YEAR, JANUARY_MONTH_INDEX, FIRST_DAY_OF_MONTH),
  );

describe('DashboardTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the chart with one data point per month and a localized first month label', async () => {
    fetchMonthlyTrendMock.mockResolvedValue({
      status: 'success',
      trend: { trend: buildTrendList('100.00', '40.00'), currency: 'USD' },
    });

    render(await renderDashboardTrend({ period: PERIOD, locale: LOCALE }));

    const labelList = screen.getAllByTestId('chart-label').map((node) => node.textContent);
    expect(labelList).toHaveLength(MONTH_COUNT);
    expect(labelList[FIRST_INDEX]).toBe(getMonthLabel(LOCALE));
  });

  it('localizes the month labels for the Ukrainian locale', async () => {
    fetchMonthlyTrendMock.mockResolvedValue({
      status: 'success',
      trend: { trend: buildTrendList('100.00', '40.00'), currency: 'UAH' },
    });

    render(await renderDashboardTrend({ period: PERIOD, locale: 'uk' }));

    const labelList = screen.getAllByTestId('chart-label').map((node) => node.textContent);
    expect(labelList[FIRST_INDEX]).toBe(getMonthLabel('uk'));
    expect(labelList[FIRST_INDEX]).not.toBe(getMonthLabel(LOCALE));
  });

  it('renders the empty state when every month is zero', async () => {
    fetchMonthlyTrendMock.mockResolvedValue({
      status: 'success',
      trend: { trend: buildTrendList('0.00', '0.00'), currency: 'USD' },
    });

    render(await renderDashboardTrend({ period: PERIOD, locale: LOCALE }));

    expect(screen.getByText('empty.title')).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
  });

  it('renders the empty state when the user has no default currency', async () => {
    fetchMonthlyTrendMock.mockResolvedValue({
      status: 'success',
      trend: { trend: [], currency: '' },
    });

    render(await renderDashboardTrend({ period: PERIOD, locale: LOCALE }));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the trend request fails', async () => {
    fetchMonthlyTrendMock.mockResolvedValue({ status: 'error' });

    render(await renderDashboardTrend({ period: PERIOD, locale: LOCALE }));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
