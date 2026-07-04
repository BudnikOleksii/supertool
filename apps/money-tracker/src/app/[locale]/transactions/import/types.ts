import type { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import type { ErrorCode } from '@supertool/shared/constants/error-codes';
import type {
  TransactionImportPreviewResponseDto,
  TransactionImportResponseDto,
} from '@supertool/shared/generated/types.gen';

import type { ImportFileCheckErrorKey } from './utils/check-import-file';

export type ImportErrorKey = ErrorCode | typeof UNKNOWN_ERROR_CODE | ImportFileCheckErrorKey;

export interface ImportActionError {
  status: 'error';
  code: ImportErrorKey;
  rowErrorList?: string[] | undefined;
}

export type PreviewTransactionImportState =
  | { status: 'success'; preview: TransactionImportPreviewResponseDto }
  | ImportActionError;

export type ExecuteTransactionImportState =
  | { status: 'success'; report: TransactionImportResponseDto }
  | ImportActionError;
