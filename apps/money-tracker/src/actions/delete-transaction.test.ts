import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteTransaction } from './delete-transaction';

const { transactionsRemove, redirect, revalidatePath, fetchTransactions } = vi.hoisted(() => ({
  transactionsRemove: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  fetchTransactions: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => '' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({ redirect }));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  TransactionsApiService: { transactionsRemove },
}));

vi.mock('./fetch-transactions', () => ({ fetchTransactions }));

const mockTransactionsTotal = (total: number): void => {
  fetchTransactions.mockResolvedValue({ status: 'success', transactions: { meta: { total } } });
};

const TRANSACTION_ID = 'transaction-1';
const PERIOD = '2025-02';
const CURRENT_PAGE = 2;
const LOCALE = 'en';
const SINGLE_PAGE_TOTAL = 10;
const TWO_PAGE_TOTAL = 60;

describe('deleteTransaction', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes the transaction, revalidates, and clamps to the last non-empty page on success', async () => {
    transactionsRemove.mockResolvedValue({ error: undefined });
    mockTransactionsTotal(SINGLE_PAGE_TOTAL);

    await deleteTransaction({
      id: TRANSACTION_ID,
      period: PERIOD,
      page: CURRENT_PAGE,
      locale: LOCALE,
    });

    expect(transactionsRemove).toHaveBeenCalledWith({
      client: {},
      path: { id: TRANSACTION_ID },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/transactions');
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/transactions', query: { period: PERIOD } },
      locale: LOCALE,
    });
  });

  it('keeps the user on the current page when it is still within range', async () => {
    transactionsRemove.mockResolvedValue({ error: undefined });
    mockTransactionsTotal(TWO_PAGE_TOTAL);

    await deleteTransaction({
      id: TRANSACTION_ID,
      period: PERIOD,
      page: CURRENT_PAGE,
      locale: LOCALE,
    });

    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/transactions', query: { period: PERIOD, page: '2' } },
      locale: LOCALE,
    });
  });

  it('maps an API NOT_FOUND error to an error ActionState and does not redirect', async () => {
    transactionsRemove.mockResolvedValue({
      error: { code: 'NOT_FOUND', message: 'Transaction not found' },
    });

    const actual = await deleteTransaction({
      id: TRANSACTION_ID,
      period: PERIOD,
      page: CURRENT_PAGE,
      locale: LOCALE,
    });

    expect(actual).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'Transaction not found',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
