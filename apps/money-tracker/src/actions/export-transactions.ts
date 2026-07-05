'use server';

import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import type { TransactionExportFormat } from '@supertool/shared/constants/transaction-export';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';
import type {
  ErrorResponseDto,
  TransactionsExportData,
} from '@supertool/shared/generated/types.gen';

import type { ExportErrorKey, ExportTransactionsState } from '../types/transaction-export';

type ExportQuery = NonNullable<TransactionsExportData['query']>;

const CONTENT_TYPE_HEADER = 'Content-Type';
const CONTENT_DISPOSITION_HEADER = 'Content-Disposition';
const FILENAME_PATTERN = /filename="?(?<name>[^";\n]+)"?/u;

const FALLBACK_MIME_TYPE: Readonly<Record<TransactionExportFormat, string>> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

const FALLBACK_FILE_NAME: Readonly<Record<TransactionExportFormat, string>> = {
  csv: 'transactions.csv',
  json: 'transactions.json',
};

const checkIsErrorResponse = (value: unknown): value is ErrorResponseDto =>
  typeof value === 'object' && value !== null && 'code' in value;

const getErrorCode = (error: unknown): ExportErrorKey =>
  checkIsErrorResponse(error) ? error.code : UNKNOWN_ERROR_CODE;

const getFileName = (response: Response, format: TransactionExportFormat): string => {
  const contentDisposition = response.headers.get(CONTENT_DISPOSITION_HEADER);
  const name =
    contentDisposition === null
      ? undefined
      : FILENAME_PATTERN.exec(contentDisposition)?.groups?.name;

  return name?.trim() ?? FALLBACK_FILE_NAME[format];
};

export const exportTransactions = async (query: ExportQuery): Promise<ExportTransactionsState> => {
  try {
    const cookieStore = await cookies();
    const { data, error, response } = await TransactionsApiService.transactionsExport({
      client: createServerApiClient({ cookieHeader: cookieStore.toString() }),
      query,
      parseAs: 'text',
    });

    if (error !== undefined || data === undefined || response === undefined) {
      return { status: 'error', code: getErrorCode(error) };
    }

    return {
      status: 'success',
      content: data,
      fileName: getFileName(response, query.format),
      mimeType: response.headers.get(CONTENT_TYPE_HEADER) ?? FALLBACK_MIME_TYPE[query.format],
    };
  } catch {
    return { status: 'error', code: UNKNOWN_ERROR_CODE };
  }
};
