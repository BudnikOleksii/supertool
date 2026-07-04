import { afterEach, describe, expect, it, vi } from 'vitest';

import { TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } from '@supertool/shared/constants/transaction-import';

import { previewTransactionImport } from './preview-transaction-import';

const { transactionsImportPreview } = vi.hoisted(() => ({
  transactionsImportPreview: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => '' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  TransactionsApiService: { transactionsImportPreview },
}));

const SINGLE_BYTE = 1;

const prepareFormDataWithFile = (file: File): FormData => {
  const formData = new FormData();

  formData.append('file', file);

  return formData;
};

const PREVIEW_RESPONSE = {
  totalRows: 3,
  newRows: 2,
  duplicateRows: 1,
  topLevelCategoriesToCreateList: ['Food'],
  childCategoriesToCreateList: ['Food > Groceries'],
  nearDuplicateClusterList: [],
};

describe('previewTransactionImport', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a validation error when the form data has no file', async () => {
    const actual = await previewTransactionImport(new FormData());

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(transactionsImportPreview).not.toHaveBeenCalled();
  });

  it('rejects an oversize file before calling the API', async () => {
    const oversizeFile = new File(
      ['a'.repeat(TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES + SINGLE_BYTE)],
      'over.json',
    );

    const actual = await previewTransactionImport(prepareFormDataWithFile(oversizeFile));

    expect(actual).toEqual({ status: 'error', code: 'fileTooLarge' });
    expect(transactionsImportPreview).not.toHaveBeenCalled();
  });

  it('returns the preview payload on success', async () => {
    transactionsImportPreview.mockResolvedValue({
      data: PREVIEW_RESPONSE,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });

    const actual = await previewTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'success', preview: PREVIEW_RESPONSE });
  });

  it('passes rowErrorList through on a validation failure', async () => {
    transactionsImportPreview.mockResolvedValue({
      data: undefined,
      error: {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Import validation failed',
        details: { rowErrorList: ['Row 1: amount is invalid', 'Row 2: date is invalid'] },
      },
      response: new Response(null, { status: 400 }),
    });

    const actual = await previewTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({
      status: 'error',
      code: 'VALIDATION_ERROR',
      rowErrorList: ['Row 1: amount is invalid', 'Row 2: date is invalid'],
    });
  });

  it('ignores a malformed rowErrorList payload', async () => {
    transactionsImportPreview.mockResolvedValue({
      data: undefined,
      error: {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Import validation failed',
        details: { rowErrorList: [{ row: 1 }] },
      },
      response: new Response(null, { status: 400 }),
    });

    const actual = await previewTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
  });

  it('maps a 413 response to fileTooLarge by status, not by body code', async () => {
    transactionsImportPreview.mockResolvedValue({
      data: undefined,
      error: { statusCode: 413, code: 'INTERNAL_ERROR', message: 'Payload Too Large' },
      response: new Response(null, { status: 413 }),
    });

    const actual = await previewTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'error', code: 'fileTooLarge' });
  });

  it('falls back to UNKNOWN when the error has no code', async () => {
    transactionsImportPreview.mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });

    const actual = await previewTransactionImport(
      prepareFormDataWithFile(new File(['[]'], 'transactions.json')),
    );

    expect(actual).toEqual({ status: 'error', code: 'UNKNOWN' });
  });
});
