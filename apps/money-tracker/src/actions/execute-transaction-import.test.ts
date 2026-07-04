import { afterEach, describe, expect, it, vi } from 'vitest';

import { TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } from '@supertool/shared/constants/transaction-import';

import { executeTransactionImport } from './execute-transaction-import';

const { transactionsImport, revalidatePath } = vi.hoisted(() => ({
  transactionsImport: vi.fn(),
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
  TransactionsApiService: { transactionsImport },
}));

const SINGLE_BYTE = 1;

const prepareFormDataWithFile = (file: File): FormData => {
  const formData = new FormData();

  formData.append('file', file);

  return formData;
};

const IMPORT_REPORT = {
  inserted: 5,
  skippedDuplicates: 2,
  topLevelCategoriesCreated: 1,
  childCategoriesCreated: 3,
  nearDuplicateClusterList: [],
};

describe('executeTransactionImport', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a validation error when the form data has no file', async () => {
    const actual = await executeTransactionImport(new FormData());

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(transactionsImport).not.toHaveBeenCalled();
  });

  it('rejects an oversize file before calling the API', async () => {
    const oversizeFile = new File(
      ['a'.repeat(TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES + SINGLE_BYTE)],
      'over.json',
    );

    const actual = await executeTransactionImport(prepareFormDataWithFile(oversizeFile));

    expect(actual).toEqual({ status: 'error', code: 'fileTooLarge' });
    expect(transactionsImport).not.toHaveBeenCalled();
  });

  it('returns the report and revalidates the affected routes on success', async () => {
    transactionsImport.mockResolvedValue({
      data: IMPORT_REPORT,
      error: undefined,
      response: new Response(null, { status: 201 }),
    });

    const actual = await executeTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'success', report: IMPORT_REPORT });
    expect(revalidatePath).toHaveBeenCalledWith('/transactions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/categories');
  });

  it('maps a 413 response to fileTooLarge and does not revalidate', async () => {
    transactionsImport.mockResolvedValue({
      data: undefined,
      error: { statusCode: 413, code: 'INTERNAL_ERROR', message: 'Payload Too Large' },
      response: new Response(null, { status: 413 }),
    });

    const actual = await executeTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'error', code: 'fileTooLarge' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps an API error code without revalidating', async () => {
    transactionsImport.mockResolvedValue({
      data: undefined,
      error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      response: new Response(null, { status: 401 }),
    });

    const actual = await executeTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'error', code: 'UNAUTHORIZED' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
