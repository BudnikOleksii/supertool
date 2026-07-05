import type { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import type { ErrorCode } from '@supertool/shared/constants/error-codes';

export type ExportErrorKey = ErrorCode | typeof UNKNOWN_ERROR_CODE;

export type ExportTransactionsState =
  | { status: 'success'; content: string; fileName: string; mimeType: string }
  | { status: 'error'; code: ExportErrorKey };
