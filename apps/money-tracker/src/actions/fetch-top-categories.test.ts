import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TopCategoriesResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchTopCategories } from './fetch-top-categories';

const { analyticsGetTopCategories } = vi.hoisted(() => ({
  analyticsGetTopCategories: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  AnalyticsApiService: { analyticsGetTopCategories },
}));

const PARAMS = { dateFrom: '2025-02-01', dateTo: '2025-02-28', limit: 5 };

const RESPONSE: TopCategoriesResponseDto = {
  categories: [
    {
      rank: 1,
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      total: '420.00',
      share: 70,
      transactionCount: 12,
    },
  ],
  totalExpense: '600.00',
  currency: 'USD',
};

describe('fetchTopCategories', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the range and limit query and returns the success payload', async () => {
    analyticsGetTopCategories.mockResolvedValue({ data: RESPONSE, error: undefined });

    const actual = await fetchTopCategories(PARAMS);

    expect(analyticsGetTopCategories).toHaveBeenCalledWith({
      client: {},
      query: { dateFrom: '2025-02-01', dateTo: '2025-02-28', limit: 5 },
    });
    expect(actual).toEqual({ status: 'success', topCategories: RESPONSE });
  });

  it('returns an error result when the endpoint errors', async () => {
    analyticsGetTopCategories.mockResolvedValue({ data: undefined, error: { statusCode: 500 } });

    expect(await fetchTopCategories(PARAMS)).toEqual({ status: 'error' });
  });
});
