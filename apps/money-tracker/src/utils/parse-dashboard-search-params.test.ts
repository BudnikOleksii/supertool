import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLatestTransactionDate } from '../actions/fetch-latest-transaction-date';
import { parseDashboardSearchParams } from './parse-dashboard-search-params';

vi.mock('../actions/fetch-latest-transaction-date', () => ({
  fetchLatestTransactionDate: vi.fn(),
}));

const mockFetchLatestTransactionDate = vi.mocked(fetchLatestTransactionDate);

const CURRENT_MONTH = new Date('2026-06-15T12:00:00.000Z');

describe('parseDashboardSearchParams', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(CURRENT_MONTH);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns a valid explicit range verbatim without looking up the latest transaction', async () => {
    const actual = await parseDashboardSearchParams({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
    });

    expect(actual).toEqual({ dateFrom: '2025-02-01', dateTo: '2025-02-28', type: undefined });
    expect(mockFetchLatestTransactionDate).not.toHaveBeenCalled();
  });

  it('parses a known transaction type from the URL', async () => {
    const actual = await parseDashboardSearchParams({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: 'income',
    });

    expect(actual.type).toBe('income');
  });

  it('drops an unknown transaction type to undefined', async () => {
    const actual = await parseDashboardSearchParams({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: 'transfer',
    });

    expect(actual.type).toBeUndefined();
  });

  it('falls back to the auto-fit month range when the window is reversed', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2025-02-03');

    const actual = await parseDashboardSearchParams({
      dateFrom: '2025-02-28',
      dateTo: '2025-02-01',
    });

    expect(actual).toEqual({ dateFrom: '2025-02-01', dateTo: '2025-02-28', type: undefined });
  });

  it('falls back to the auto-fit month range when a date is malformed', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2025-02-03');

    const actual = await parseDashboardSearchParams({
      dateFrom: '2025-2-1',
      dateTo: '2025-02-28',
    });

    expect(actual).toEqual({ dateFrom: '2025-02-01', dateTo: '2025-02-28', type: undefined });
  });

  it('defaults to the auto-fit month range when both dates are absent', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2025-02-03');

    const actual = await parseDashboardSearchParams({});

    expect(actual).toEqual({ dateFrom: '2025-02-01', dateTo: '2025-02-28', type: undefined });
  });

  it('preserves the type filter even when the range falls back to the default', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2025-02-03');

    const actual = await parseDashboardSearchParams({ type: 'expense' });

    expect(actual).toEqual({ dateFrom: '2025-02-01', dateTo: '2025-02-28', type: 'expense' });
  });
});
