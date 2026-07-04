import { describe, expect, it } from 'vitest';

import { TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } from '@supertool/shared/constants/transaction-import';

import { checkImportFile } from './check-import-file';

const SINGLE_BYTE = 1;

const prepareFileOfSize = (sizeBytes: number, name: string): File =>
  new File(['a'.repeat(sizeBytes)], name);

describe('checkImportFile', () => {
  it('accepts a .json file within the size limit', () => {
    expect(checkImportFile(prepareFileOfSize(SINGLE_BYTE, 'transactions.json'))).toEqual({
      ok: true,
    });
  });

  it('accepts a .csv file within the size limit', () => {
    expect(checkImportFile(prepareFileOfSize(SINGLE_BYTE, 'transactions.csv'))).toEqual({
      ok: true,
    });
  });

  it('accepts uppercase extensions the way the server does', () => {
    expect(checkImportFile(prepareFileOfSize(SINGLE_BYTE, 'TRANSACTIONS.JSON'))).toEqual({
      ok: true,
    });
    expect(checkImportFile(prepareFileOfSize(SINGLE_BYTE, 'TRANSACTIONS.CSV'))).toEqual({
      ok: true,
    });
  });

  it('rejects unsupported extensions', () => {
    expect(checkImportFile(prepareFileOfSize(SINGLE_BYTE, 'transactions.txt'))).toEqual({
      ok: false,
      errorKey: 'unsupportedFileType',
    });
  });

  it('rejects files without an extension', () => {
    expect(checkImportFile(prepareFileOfSize(SINGLE_BYTE, 'transactions'))).toEqual({
      ok: false,
      errorKey: 'unsupportedFileType',
    });
  });

  it('rejects an empty file', () => {
    expect(checkImportFile(new File([], 'transactions.json'))).toEqual({
      ok: false,
      errorKey: 'fileEmpty',
    });
  });

  it('accepts a file of exactly the maximum size', () => {
    expect(
      checkImportFile(prepareFileOfSize(TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES, 'max.json')),
    ).toEqual({ ok: true });
  });

  it('rejects a file one byte over the maximum size', () => {
    expect(
      checkImportFile(
        prepareFileOfSize(TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES + SINGLE_BYTE, 'over.json'),
      ),
    ).toEqual({ ok: false, errorKey: 'fileTooLarge' });
  });
});
