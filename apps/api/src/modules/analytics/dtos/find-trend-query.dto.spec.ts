import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { FindTrendQueryDto } from './find-trend-query.dto';

const validateQuery = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(FindTrendQueryDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

describe('FindTrendQueryDto', () => {
  it('accepts a window where dateTo is after dateFrom', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2024-03-01', dateTo: '2025-02-28' });

    expect(actualErrorList).toEqual([]);
  });

  it('accepts a window where dateTo equals dateFrom', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-01', dateTo: '2025-02-01' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a reversed window where dateTo precedes dateFrom', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2025-02-28', dateTo: '2024-03-01' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('rejects a malformed date', async () => {
    const actualErrorList = await validateQuery({ dateFrom: '2024-3-1', dateTo: '2025-02-28' });

    expect(actualErrorList).toContain('dateFrom');
  });
});
