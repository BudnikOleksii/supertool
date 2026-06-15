import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTransaction } from './create-transaction';

const { transactionsCreate, redirect, revalidatePath, fetchTransactions } = vi.hoisted(() => ({
  transactionsCreate: vi.fn(),
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
  TransactionsApiService: { transactionsCreate },
}));

vi.mock('./fetch-transactions', () => ({ fetchTransactions }));

const mockTransactionsBefore = (total: number): void => {
  fetchTransactions.mockResolvedValue({ status: 'success', transactions: { meta: { total } } });
};

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
const TRANSACTIONS_BEFORE_THIRD_PAGE = 120;

describe('createTransaction', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps an API NOT_FOUND error to an error ActionState', async () => {
    transactionsCreate.mockResolvedValue({
      data: undefined,
      error: { code: 'NOT_FOUND', message: 'Category not found' },
    });

    const actual = await createTransaction(VALID_VALUES, LOCALE);

    expect(actual).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'Category not found',
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('maps an API UNPROCESSABLE_ENTITY error to an error ActionState', async () => {
    transactionsCreate.mockResolvedValue({
      data: undefined,
      error: { code: 'UNPROCESSABLE_ENTITY', message: 'Category type does not match' },
    });

    const actual = await createTransaction(VALID_VALUES, LOCALE);

    expect(actual).toEqual({
      status: 'error',
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Category type does not match',
    });
  });

  it('returns a validation error without calling the API when input is invalid', async () => {
    const actual = await createTransaction({ ...VALID_VALUES, amount: '0' }, LOCALE);

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(transactionsCreate).not.toHaveBeenCalled();
  });

  it('revalidates and redirects to the created month on success', async () => {
    transactionsCreate.mockResolvedValue({ data: { id: 'transaction-1' }, error: undefined });
    mockTransactionsBefore(NO_TRANSACTIONS_BEFORE);

    await createTransaction(VALID_VALUES, LOCALE);

    expect(revalidatePath).toHaveBeenCalledWith('/transactions');
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/transactions', query: { period: '2025-02' } },
      locale: LOCALE,
    });
  });

  it('redirects to the page that holds a back-dated transaction', async () => {
    transactionsCreate.mockResolvedValue({ data: { id: 'transaction-1' }, error: undefined });
    mockTransactionsBefore(TRANSACTIONS_BEFORE_THIRD_PAGE);

    await createTransaction(VALID_VALUES, LOCALE);

    expect(fetchTransactions).toHaveBeenCalledWith({
      dateFrom: '2025-02-04',
      dateTo: '2025-02-28',
      page: 1,
      limit: 1,
    });
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/transactions', query: { period: '2025-02', page: '3' } },
      locale: LOCALE,
    });
  });
});
