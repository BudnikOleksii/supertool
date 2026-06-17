import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLatestTransactionDate } from '../actions/fetch-latest-transaction-date';
import { resolveDefaultPeriod } from './resolve-default-period';

vi.mock('../actions/fetch-latest-transaction-date', () => ({
  fetchLatestTransactionDate: vi.fn(),
}));

const mockFetchLatestTransactionDate = vi.mocked(fetchLatestTransactionDate);

const CURRENT_MONTH = new Date('2026-06-15T12:00:00.000Z');

describe('resolveDefaultPeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(CURRENT_MONTH);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns a valid URL period verbatim without looking up the latest transaction', async () => {
    const actual = await resolveDefaultPeriod('2026-06');

    expect(actual).toBe('2026-06');
    expect(mockFetchLatestTransactionDate).not.toHaveBeenCalled();
  });

  it('auto-fits to the latest transaction month when no URL period is present', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2025-02-03');

    expect(await resolveDefaultPeriod(undefined)).toBe('2025-02');
  });

  it('auto-fits to the latest transaction month when the URL period is invalid', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2025-02-03');

    expect(await resolveDefaultPeriod('not-a-period')).toBe('2025-02');
  });

  it('keeps the current month when the latest transaction is in the current month', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2026-06-01');

    expect(await resolveDefaultPeriod(undefined)).toBe('2026-06');
  });

  it('falls back to the current month when the user has no transactions', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue(null);

    expect(await resolveDefaultPeriod(undefined)).toBe('2026-06');
  });

  it('clamps a future-dated latest transaction back to the current month', async () => {
    mockFetchLatestTransactionDate.mockResolvedValue('2027-09-20');

    expect(await resolveDefaultPeriod(undefined)).toBe('2026-06');
  });
});
