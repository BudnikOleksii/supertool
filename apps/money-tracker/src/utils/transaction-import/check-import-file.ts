import { TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } from '@supertool/shared/constants/transaction-import';

const ACCEPTED_EXTENSION_LIST = ['.json', '.csv'] as const;
const EMPTY_FILE_SIZE_BYTES = 0;

export type ImportFileCheckErrorKey = 'unsupportedFileType' | 'fileEmpty' | 'fileTooLarge';

export type ImportFileCheckResult = { ok: true } | { ok: false; errorKey: ImportFileCheckErrorKey };

const getFileExtension = (fileName: string): string =>
  fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

const checkIsAcceptedExtension = (extension: string): boolean =>
  ACCEPTED_EXTENSION_LIST.some((acceptedExtension) => acceptedExtension === extension);

export const checkImportFile = (file: File): ImportFileCheckResult => {
  if (!checkIsAcceptedExtension(getFileExtension(file.name))) {
    return { ok: false, errorKey: 'unsupportedFileType' };
  }

  if (file.size === EMPTY_FILE_SIZE_BYTES) {
    return { ok: false, errorKey: 'fileEmpty' };
  }

  if (file.size > TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES) {
    return { ok: false, errorKey: 'fileTooLarge' };
  }

  return { ok: true };
};
