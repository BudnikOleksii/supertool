import { afterEach, describe, expect, it, vi } from 'vitest';

import { exportTransactions } from './export-transactions';

const { transactionsExport } = vi.hoisted(() => ({
  transactionsExport: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  TransactionsApiService: { transactionsExport },
}));

const buildResponse = (headers: Record<string, string>): Response =>
  new Response('body', { status: 200, headers });

describe('exportTransactions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requests the export as text through the generated client', async () => {
    transactionsExport.mockResolvedValue({
      data: 'csv-body',
      error: undefined,
      response: buildResponse({ 'Content-Type': 'text/csv; charset=utf-8' }),
    });

    await exportTransactions({ format: 'csv', dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    expect(transactionsExport).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { format: 'csv', dateFrom: '2025-02-01', dateTo: '2025-02-28' },
        parseAs: 'text',
      }),
    );
  });

  it('returns content, filename from Content-Disposition, and mime type on success', async () => {
    transactionsExport.mockResolvedValue({
      data: 'csv-body',
      error: undefined,
      response: buildResponse({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="transactions-2025-02-01_2025-02-28.csv"',
      }),
    });

    const actual = await exportTransactions({ format: 'csv' });

    expect(actual).toEqual({
      status: 'success',
      content: 'csv-body',
      fileName: 'transactions-2025-02-01_2025-02-28.csv',
      mimeType: 'text/csv; charset=utf-8',
    });
  });

  it('falls back to a default filename when Content-Disposition is absent', async () => {
    transactionsExport.mockResolvedValue({
      data: '[]',
      error: undefined,
      response: buildResponse({ 'Content-Type': 'application/json; charset=utf-8' }),
    });

    const actual = await exportTransactions({ format: 'json' });

    expect(actual).toEqual({
      status: 'success',
      content: '[]',
      fileName: 'transactions.json',
      mimeType: 'application/json; charset=utf-8',
    });
  });

  it('maps an API error to its code', async () => {
    transactionsExport.mockResolvedValue({
      data: undefined,
      error: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'bad' },
      response: buildResponse({}),
    });

    const actual = await exportTransactions({ format: 'csv' });

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
  });

  it('falls back to UNKNOWN when the error has no code', async () => {
    transactionsExport.mockResolvedValue({
      data: undefined,
      error: 'network down',
      response: buildResponse({}),
    });

    const actual = await exportTransactions({ format: 'csv' });

    expect(actual).toEqual({ status: 'error', code: 'UNKNOWN' });
  });

  it('catches a thrown rejection and maps it to UNKNOWN', async () => {
    transactionsExport.mockRejectedValue(new Error('boom'));

    const actual = await exportTransactions({ format: 'csv' });

    expect(actual).toEqual({ status: 'error', code: 'UNKNOWN' });
  });
});
