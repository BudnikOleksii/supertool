import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ANALYTICS_MAX_RANGE_DAYS } from '@supertool/shared/constants/analytics';

import { IsBoundedDateRange } from './is-bounded-date-range.decorator';

const MAX_DAYS = 10;

@IsBoundedDateRange('dateFrom', 'dateTo', MAX_DAYS)
class BoundedRangeFixtureDto {
  dateFrom!: string;

  dateTo!: string;
}

@IsBoundedDateRange('dateFrom', 'dateTo', ANALYTICS_MAX_RANGE_DAYS)
class AnalyticsRangeFixtureDto {
  dateFrom!: string;

  dateTo!: string;
}

const validateBounded = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(BoundedRangeFixtureDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

const validateAnalyticsRange = async (input: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(AnalyticsRangeFixtureDto, input);
  const errorList = await validate(dto);

  return errorList.map((error) => error.property);
};

describe('IsBoundedDateRange', () => {
  it('accepts a span within the cap', async () => {
    const actualErrorList = await validateBounded({ dateFrom: '2025-02-01', dateTo: '2025-02-05' });

    expect(actualErrorList).toEqual([]);
  });

  it('accepts a span exactly equal to the cap (inclusive)', async () => {
    const actualErrorList = await validateBounded({ dateFrom: '2025-02-01', dateTo: '2025-02-10' });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a span that exceeds the cap by one day', async () => {
    const actualErrorList = await validateBounded({ dateFrom: '2025-02-01', dateTo: '2025-02-11' });

    expect(actualErrorList).toContain('dateTo');
  });

  it('accepts a full twelve-month trend window under the analytics cap', async () => {
    const actualErrorList = await validateAnalyticsRange({
      dateFrom: '2024-03-01',
      dateTo: '2025-02-28',
    });

    expect(actualErrorList).toEqual([]);
  });

  it('accepts a leap-year twelve-month window under the analytics cap', async () => {
    const actualErrorList = await validateAnalyticsRange({
      dateFrom: '2023-03-01',
      dateTo: '2024-02-29',
    });

    expect(actualErrorList).toEqual([]);
  });

  it('rejects a multi-year span above the analytics cap', async () => {
    const actualErrorList = await validateAnalyticsRange({
      dateFrom: '2020-01-01',
      dateTo: '2025-01-01',
    });

    expect(actualErrorList).toContain('dateTo');
  });
});
