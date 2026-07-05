import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { TRANSACTION_SEARCH_MAX_LENGTH } from '@supertool/shared/constants/transaction-search';

import { FindTransactionsQueryDto } from './find-transactions-query.dto';

const validateQuery = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(FindTransactionsQueryDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

const OVER_LIMIT_LENGTH = TRANSACTION_SEARCH_MAX_LENGTH + 1;

describe('FindTransactionsQueryDto', () => {
  it('accepts an omitted search', async () => {
    const actualErrorList = await validateQuery({});

    expect(actualErrorList).toEqual([]);
  });

  it('accepts a search within the maximum length', async () => {
    const actualErrorList = await validateQuery({ search: 'coffee' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a search longer than the maximum length', async () => {
    const actualErrorList = await validateQuery({ search: 'x'.repeat(OVER_LIMIT_LENGTH) });

    expect(actualErrorList).toContain('search');
  });

  it('accepts a valid calendar date window', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a shaped-but-invalid calendar date (calendar hardening through IntersectionType)', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-31' });

    expect(actualErrorList).toContain('dateFrom');
  });

  it('rejects an out-of-range month', async () => {
    const actualErrorList = await validateQuery({ dateTo: '2025-13-01' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('rejects a reversed date range (ordered-range guard through IntersectionType)', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-28', dateTo: '2025-02-01' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('accepts a single-sided date bound without a range-order error', async () => {
    const actualErrorList = await validateQuery({ dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });
});
