import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';
import type { ErrorResponseDto } from '@supertool/shared/generated/types.gen';

import type { ImportActionError } from '../../types/transaction-import';

const checkIsStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const getRowErrorList = (error: ErrorResponseDto | undefined): string[] | undefined => {
  const rowErrorList = error?.details?.rowErrorList;

  return checkIsStringList(rowErrorList) ? rowErrorList : undefined;
};

export const prepareImportErrorState = (
  error: ErrorResponseDto | undefined,
  response: Response | undefined,
): ImportActionError => {
  if (response?.status === HTTP_STATUS_CODE.PayloadTooLarge) {
    return { status: 'error', code: 'fileTooLarge' };
  }

  const rowErrorList = getRowErrorList(error);

  if (rowErrorList === undefined) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE };
  }

  return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, rowErrorList };
};
