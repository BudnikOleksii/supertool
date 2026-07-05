import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { FindSummaryQueryDto } from './find-summary-query.dto';

const validateQuery = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(FindSummaryQueryDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

describe('FindSummaryQueryDto', () => {
  it('accepts a valid calendar-date window', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a shaped-but-invalid calendar date', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-31', dateTo: '2025-02-28' });

    expect(actualErrorList).toContain('dateFrom');
  });

  it('rejects an out-of-range month and a zero day', async () => {
    expect(await validateQuery({ dateFrom: '2025-13-01', dateTo: '2025-02-28' })).toContain(
      'dateFrom',
    );
    expect(await validateQuery({ dateFrom: '2025-00-10', dateTo: '2025-02-28' })).toContain(
      'dateFrom',
    );
  });

  it('rejects a reversed window', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-28', dateTo: '2025-02-01' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('rejects a window whose span exceeds the analytics maximum range', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2020-01-01', dateTo: '2025-01-01' });

    expect(actualErrorList).toContain('dateTo');
  });
});
