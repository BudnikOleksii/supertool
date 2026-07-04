import { afterEach, describe, expect, it, vi } from 'vitest';

import { assignDefaultCategories } from './assign-default-categories';

const { transactionCategoriesCreateDefaults, revalidatePath } = vi.hoisted(() => ({
  transactionCategoriesCreateDefaults: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => '' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  TransactionCategoriesApiService: { transactionCategoriesCreateDefaults },
}));

describe('assignDefaultCategories', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the created counts and revalidates categories on success', async () => {
    const result = { topLevelCreated: 18, childrenCreated: 39 };
    transactionCategoriesCreateDefaults.mockResolvedValue({ data: result, error: undefined });

    const actual = await assignDefaultCategories();

    expect(actual).toEqual({ status: 'success', result });
    expect(revalidatePath).toHaveBeenCalledWith('/categories');
  });

  it('passes an API error through as an error state', async () => {
    transactionCategoriesCreateDefaults.mockResolvedValue({
      data: undefined,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    });

    const actual = await assignDefaultCategories();

    expect(actual).toEqual({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Session expired',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
