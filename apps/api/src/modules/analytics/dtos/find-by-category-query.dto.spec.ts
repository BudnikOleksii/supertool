import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { FindByCategoryQueryDto } from './find-by-category-query.dto';

const validateQuery = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(FindByCategoryQueryDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

describe('FindByCategoryQueryDto', () => {
  it('accepts a valid window', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a missing dateFrom', async () => {
    const actualErrorList = await validateQuery({ dateTo: '2025-02-28' });

    expect(actualErrorList).toContain('dateFrom');
  });

  it('rejects a malformed date', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-2-1', dateTo: '2025-02-28' });

    expect(actualErrorList).toContain('dateFrom');
  });

  it('rejects a reversed window where dateTo precedes dateFrom', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-28', dateTo: '2025-02-01' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('rejects a shaped-but-invalid calendar date', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-31', dateTo: '2025-02-28' });

    expect(actualErrorList).toContain('dateFrom');
  });

  it('rejects a window whose span exceeds the analytics maximum range', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2020-01-01', dateTo: '2025-01-01' });

    expect(actualErrorList).toContain('dateTo');
  });
});
