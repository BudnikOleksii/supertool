import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { MAX_BULK_DELETE_IDS } from '@supertool/shared/constants/transaction-bulk';

import { BulkDeleteTransactionsDto } from './bulk-delete-transactions.dto';

const OVER_CAP_EXTRA = 1;
const NON_STRING_ENTRY = 123;

const validateBody = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(BulkDeleteTransactionsDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

const buildIdList = (size: number): string[] =>
  Array.from({ length: size }, (_value, index) => `id-${String(index)}`);

describe('BulkDeleteTransactionsDto', () => {
  it('accepts a valid id list within the cap', async () => {
    const actualErrorList = await validateBody({ idList: buildIdList(MAX_BULK_DELETE_IDS) });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects an empty id list', async () => {
    const actualErrorList = await validateBody({ idList: [] });

    expect(actualErrorList).toContain('idList');
  });

  it('rejects an id list above the cap', async () => {
    const actualErrorList = await validateBody({
      idList: buildIdList(MAX_BULK_DELETE_IDS + OVER_CAP_EXTRA),
    });

    expect(actualErrorList).toContain('idList');
  });

  it('rejects a list with duplicate ids', async () => {
    const actualErrorList = await validateBody({ idList: ['id-1', 'id-1'] });

    expect(actualErrorList).toContain('idList');
  });

  it('rejects non-string entries', async () => {
    const actualErrorList = await validateBody({ idList: [NON_STRING_ENTRY] });

    expect(actualErrorList).toContain('idList');
  });
});
