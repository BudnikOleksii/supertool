import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailySpendingDayDto } from '@supertool/shared/generated/types.gen';

import { fetchDailySpending } from '../../../../../actions/fetch-daily-spending';
import { DashboardDailySpending } from './DashboardDailySpending';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('./DashboardDailySpending.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('next/dynamic', () => ({
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- factory cannot reference module-scope (vi.mock is hoisted above declarations)
  default: () => (props: { chartData: { label: string; value: number }[] }) => (
    <div data-testid="chart">
      {props.chartData.map((datum) => (
        <span key={datum.label} data-testid="chart-label" data-value={datum.value}>
          {datum.label}
        </span>
      ))}
    </div>
  ),
}));

vi.mock('../../../../../actions/fetch-daily-spending', () => ({
  fetchDailySpending: vi.fn(),
}));

const fetchDailySpendingMock = vi.mocked(fetchDailySpending);

const renderWidget = DashboardDailySpending;

const LOCALE = 'en';
const RANGE = { dateFrom: '2025-02-01', dateTo: '2025-02-28', locale: LOCALE };

const DAY_OFFSET = 1;
const MONTH_INDEX_OFFSET = 1;
const ZERO_AMOUNT = '0.00';
const ZERO_COUNT = 0;
const ONE_COUNT = 1;

const buildDays = (...totalList: string[]): DailySpendingDayDto[] =>
  totalList.map((total, index) => ({
    date: `2025-02-0${index + DAY_OFFSET}`,
    total,
    transactionCount: total === ZERO_AMOUNT ? ZERO_COUNT : ONE_COUNT,
  }));

const getDayLabel = (date: string, locale: string): string => {
  const [yearPart, monthPart, dayPart] = date.split('-');
  const parsedDate = new Date(
    Number(yearPart),
    Number(monthPart) - MONTH_INDEX_OFFSET,
    Number(dayPart),
  );

  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parsedDate);
};

describe('DashboardDailySpending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps each day to a chart datum with a localized label and numeric value', async () => {
    fetchDailySpendingMock.mockResolvedValue({
      status: 'success',
      dailySpending: { days: buildDays('42.00', '10.50'), totalExpense: '52.50', currency: 'USD' },
    });

    render(await renderWidget(RANGE));

    const labelNodeList = screen.getAllByTestId('chart-label');
    expect(labelNodeList.map((node) => node.textContent)).toEqual([
      getDayLabel('2025-02-01', LOCALE),
      getDayLabel('2025-02-02', LOCALE),
    ]);
    expect(labelNodeList.map((node) => node.getAttribute('data-value'))).toEqual(['42', '10.5']);
  });

  it('localizes the day labels for the Ukrainian locale', async () => {
    fetchDailySpendingMock.mockResolvedValue({
      status: 'success',
      dailySpending: { days: buildDays('42.00'), totalExpense: '42.00', currency: 'UAH' },
    });

    render(await renderWidget({ ...RANGE, locale: 'uk' }));

    const [label] = screen.getAllByTestId('chart-label');
    expect(label?.textContent).toBe(getDayLabel('2025-02-01', 'uk'));
    expect(label?.textContent).not.toBe(getDayLabel('2025-02-01', LOCALE));
  });

  it('renders the empty state when every day is zero', async () => {
    fetchDailySpendingMock.mockResolvedValue({
      status: 'success',
      dailySpending: { days: buildDays('0.00', '0.00'), totalExpense: '0.00', currency: 'USD' },
    });

    render(await renderWidget(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
  });

  it('renders the empty state when the user has no default currency', async () => {
    fetchDailySpendingMock.mockResolvedValue({
      status: 'success',
      dailySpending: { days: [], totalExpense: '0.00', currency: '' },
    });

    render(await renderWidget(RANGE));

    expect(screen.getByText('empty.title')).toBeTruthy();
  });

  it('renders the error state when the request fails', async () => {
    fetchDailySpendingMock.mockResolvedValue({ status: 'error' });

    render(await renderWidget(RANGE));

    expect(screen.getByText('error.title')).toBeTruthy();
  });
});
