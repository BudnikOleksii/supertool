import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { FindBreakdownQueryDto } from './find-breakdown-query.dto';

const validateQuery = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(FindBreakdownQueryDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

describe('FindBreakdownQueryDto', () => {
  it('accepts a valid calendar-date window', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a shaped-but-invalid calendar date', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-04-31' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('rejects a reversed window', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-28', dateTo: '2025-02-01' });

    expect(actualErrorList).toContain('dateTo');
  });
});
