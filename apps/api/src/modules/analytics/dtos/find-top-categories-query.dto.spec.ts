import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  TOP_CATEGORIES_MAX_LIMIT,
  TOP_CATEGORIES_MIN_LIMIT,
} from '@supertool/shared/constants/analytics';

import { FindTopCategoriesQueryDto } from './find-top-categories-query.dto';

const validateQuery = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(FindTopCategoriesQueryDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

describe('FindTopCategoriesQueryDto', () => {
  it('accepts a valid window with a valid limit', async () => {
    const actualErrorList = await validateQuery({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: 5,
    });

    expect(actualErrorList).toEqual([]);
  });

  it('accepts a valid window when limit is omitted', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a limit below the minimum', async () => {
    const actualErrorList = await validateQuery({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: TOP_CATEGORIES_MIN_LIMIT - 1,
    });

    expect(actualErrorList).toContain('limit');
  });

  it('rejects a limit above the maximum', async () => {
    const actualErrorList = await validateQuery({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: TOP_CATEGORIES_MAX_LIMIT + 1,
    });

    expect(actualErrorList).toContain('limit');
  });

  it('rejects a non-integer limit', async () => {
    const actualErrorList = await validateQuery({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: 2.5,
    });

    expect(actualErrorList).toContain('limit');
  });

  it('rejects a reversed window where dateTo precedes dateFrom', async () => {
    const actualErrorList = await validateQuery({
      dateFrom: '2025-02-28',
      dateTo: '2025-02-01',
      limit: 5,
    });

    expect(actualErrorList).toContain('dateTo');
  });
});
