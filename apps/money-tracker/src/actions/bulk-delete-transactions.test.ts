import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_BULK_DELETE_IDS } from '@supertool/shared/constants/transaction-bulk';

import { bulkDeleteTransactions } from './bulk-delete-transactions';

const { transactionsBulkDelete, revalidatePath } = vi.hoisted(() => ({
  transactionsBulkDelete: vi.fn(),
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
  TransactionsApiService: { transactionsBulkDelete },
}));

const OVER_CAP_EXTRA = 1;

const buildIdList = (size: number): string[] =>
  Array.from({ length: size }, (_value, index) => `id-${String(index)}`);

describe('bulkDeleteTransactions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deletes and revalidates the by-date route on success', async () => {
    transactionsBulkDelete.mockResolvedValue({
      data: { deletedCount: 2, failedList: [] },
      error: undefined,
    });

    const result = await bulkDeleteTransactions({ idList: ['a', 'b'], view: { kind: 'byDate' } });

    expect(result).toEqual({ status: 'success', deletedCount: 2, failedList: [] });
    expect(transactionsBulkDelete).toHaveBeenCalledWith({
      client: {},
      body: { idList: ['a', 'b'] },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/transactions');
  });

  it('revalidates the by-category detail route on success', async () => {
    transactionsBulkDelete.mockResolvedValue({
      data: { deletedCount: 1, failedList: [] },
      error: undefined,
    });

    await bulkDeleteTransactions({
      idList: ['a'],
      view: { kind: 'byCategory', categoryId: 'cat-1' },
    });

    expect(revalidatePath).toHaveBeenCalledWith('/transactions/by-category/cat-1');
  });

  it('returns the failed list on a partial result and still revalidates', async () => {
    transactionsBulkDelete.mockResolvedValue({
      data: { deletedCount: 1, failedList: [{ id: 'b', reason: 'NOT_FOUND' }] },
      error: undefined,
    });

    const result = await bulkDeleteTransactions({ idList: ['a', 'b'], view: { kind: 'byDate' } });

    expect(result).toEqual({
      status: 'success',
      deletedCount: 1,
      failedList: [{ id: 'b', reason: 'NOT_FOUND' }],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/transactions');
  });

  it('does not revalidate when nothing was deleted', async () => {
    transactionsBulkDelete.mockResolvedValue({
      data: { deletedCount: 0, failedList: [{ id: 'a', reason: 'NOT_FOUND' }] },
      error: undefined,
    });

    await bulkDeleteTransactions({ idList: ['a'], view: { kind: 'byDate' } });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps an API error to an error result without calling revalidate', async () => {
    transactionsBulkDelete.mockResolvedValue({
      data: undefined,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    });

    const result = await bulkDeleteTransactions({ idList: ['a'], view: { kind: 'byDate' } });

    expect(result).toEqual({ status: 'error', code: 'UNAUTHORIZED', message: 'Session expired' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an over-cap list before calling the API', async () => {
    const result = await bulkDeleteTransactions({
      idList: buildIdList(MAX_BULK_DELETE_IDS + OVER_CAP_EXTRA),
      view: { kind: 'byDate' },
    });

    expect(result).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(transactionsBulkDelete).not.toHaveBeenCalled();
  });

  it('rejects an empty list before calling the API', async () => {
    const result = await bulkDeleteTransactions({ idList: [], view: { kind: 'byDate' } });

    expect(result).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(transactionsBulkDelete).not.toHaveBeenCalled();
  });
});
