import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ByCategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchTransactionsByCategory } from './fetch-transactions-by-category';

const { analyticsGetByCategory } = vi.hoisted(() => ({
  analyticsGetByCategory: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  AnalyticsApiService: { analyticsGetByCategory },
}));

const PARAMS = { dateFrom: '2025-02-01', dateTo: '2025-02-28' };

const RESPONSE: ByCategoryResponseDto = {
  categories: [
    {
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      parentId: null,
      type: 'expense',
      total: '420.00',
      transactionCount: 12,
    },
  ],
  currency: 'USD',
};

describe('fetchTransactionsByCategory', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the date-range query and returns the success payload', async () => {
    analyticsGetByCategory.mockResolvedValue({ data: RESPONSE, error: undefined });

    const actual = await fetchTransactionsByCategory(PARAMS);

    expect(analyticsGetByCategory).toHaveBeenCalledWith({
      client: {},
      query: { dateFrom: '2025-02-01', dateTo: '2025-02-28' },
    });
    expect(actual).toEqual({ status: 'success', byCategory: RESPONSE });
  });

  it('returns an error result when the endpoint errors', async () => {
    analyticsGetByCategory.mockResolvedValue({ data: undefined, error: { statusCode: 500 } });

    expect(await fetchTransactionsByCategory(PARAMS)).toEqual({ status: 'error' });
  });
});
