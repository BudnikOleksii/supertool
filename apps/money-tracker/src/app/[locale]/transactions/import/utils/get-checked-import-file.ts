import { ErrorCode } from '@supertool/shared/constants/error-codes';

import type { ImportActionError } from '../types';

import { checkImportFile } from './check-import-file';
import { getImportFile } from './get-import-file';

export type CheckedImportFileResult =
  | { ok: true; file: File }
  | { ok: false; state: ImportActionError };

export const getCheckedImportFile = (formData: FormData): CheckedImportFileResult => {
  const file = getImportFile(formData);

  if (!file) {
    return { ok: false, state: { status: 'error', code: ErrorCode.ValidationError } };
  }

  const checkResult = checkImportFile(file);

  if (!checkResult.ok) {
    return { ok: false, state: { status: 'error', code: checkResult.errorKey } };
  }

  return { ok: true, file };
};
