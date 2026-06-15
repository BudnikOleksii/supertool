import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateTransaction } from './update-transaction';

const { transactionsUpdate, redirect, revalidatePath, fetchTransactions } = vi.hoisted(() => ({
  transactionsUpdate: vi.fn(),
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
  TransactionsApiService: { transactionsUpdate },
}));

vi.mock('./fetch-transactions', () => ({ fetchTransactions }));

const mockTransactionsBefore = (total: number): void => {
  fetchTransactions.mockResolvedValue({ status: 'success', transactions: { meta: { total } } });
};

const TRANSACTION_ID = 'transaction-1';

const VALID_VALUES = {
  type: 'expense' as const,
  amount: '12.50',
  currency: 'UAH' as const,
  categoryId: 'category-id',
  date: '2025-02-03',
  note: '',
};

const LOCALE = 'en';

const NO_TRANSACTIONS_BEFORE = 0;

describe('updateTransaction', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the transaction id and body to the update endpoint', async () => {
    transactionsUpdate.mockResolvedValue({ data: { id: TRANSACTION_ID }, error: undefined });
    mockTransactionsBefore(NO_TRANSACTIONS_BEFORE);

    await updateTransaction(TRANSACTION_ID, VALID_VALUES, LOCALE);

    expect(transactionsUpdate).toHaveBeenCalledWith({
      client: {},
      path: { id: TRANSACTION_ID },
      body: {
        type: 'expense',
        amount: '12.50',
        currency: 'UAH',
        categoryId: 'category-id',
        date: '2025-02-03',
      },
    });
  });

  it('maps an API NOT_FOUND error to an error ActionState', async () => {
    transactionsUpdate.mockResolvedValue({
      data: undefined,
      error: { code: 'NOT_FOUND', message: 'Transaction not found' },
    });

    const actual = await updateTransaction(TRANSACTION_ID, VALID_VALUES, LOCALE);

    expect(actual).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'Transaction not found',
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('maps an API UNPROCESSABLE_ENTITY error to an error ActionState', async () => {
    transactionsUpdate.mockResolvedValue({
      data: undefined,
      error: { code: 'UNPROCESSABLE_ENTITY', message: 'Category type does not match' },
    });

    const actual = await updateTransaction(TRANSACTION_ID, VALID_VALUES, LOCALE);

    expect(actual).toEqual({
      status: 'error',
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Category type does not match',
    });
  });

  it('returns a validation error without calling the API when input is invalid', async () => {
    const actual = await updateTransaction(
      TRANSACTION_ID,
      { ...VALID_VALUES, amount: '0' },
      LOCALE,
    );

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(transactionsUpdate).not.toHaveBeenCalled();
  });

  it('revalidates and redirects to the transaction month on success', async () => {
    transactionsUpdate.mockResolvedValue({ data: { id: TRANSACTION_ID }, error: undefined });
    mockTransactionsBefore(NO_TRANSACTIONS_BEFORE);

    await updateTransaction(TRANSACTION_ID, VALID_VALUES, LOCALE);

    expect(revalidatePath).toHaveBeenCalledWith('/transactions');
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/transactions', query: { period: '2025-02' } },
      locale: LOCALE,
    });
  });
});
