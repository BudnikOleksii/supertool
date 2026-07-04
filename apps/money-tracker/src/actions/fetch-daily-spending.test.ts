import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DailySpendingResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchDailySpending } from './fetch-daily-spending';

const { analyticsGetDailySpending } = vi.hoisted(() => ({
  analyticsGetDailySpending: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  AnalyticsApiService: { analyticsGetDailySpending },
}));

const PARAMS = { dateFrom: '2025-02-01', dateTo: '2025-02-28' };

const RESPONSE: DailySpendingResponseDto = {
  days: [{ date: '2025-02-01', total: '42.00', transactionCount: 3 }],
  totalExpense: '42.00',
  currency: 'USD',
};

describe('fetchDailySpending', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the range query and returns the success payload', async () => {
    analyticsGetDailySpending.mockResolvedValue({ data: RESPONSE, error: undefined });

    const actual = await fetchDailySpending(PARAMS);

    expect(analyticsGetDailySpending).toHaveBeenCalledWith({
      client: {},
      query: { dateFrom: '2025-02-01', dateTo: '2025-02-28' },
    });
    expect(actual).toEqual({ status: 'success', dailySpending: RESPONSE });
  });

  it('returns an error result when the endpoint errors', async () => {
    analyticsGetDailySpending.mockResolvedValue({ data: undefined, error: { statusCode: 500 } });

    expect(await fetchDailySpending(PARAMS)).toEqual({ status: 'error' });
  });
});
