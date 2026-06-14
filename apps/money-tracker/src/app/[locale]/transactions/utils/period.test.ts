import { describe, expect, it } from 'vitest';

import {
  getCurrentPeriod,
  getMonthDateRange,
  getNextPeriod,
  getPreviousPeriod,
  parsePeriod,
} from './period';

describe('parsePeriod', () => {
  it('parses a valid YYYY-MM period', () => {
    expect(parsePeriod('2025-03')).toEqual({ year: 2025, month: 3 });
  });

  it('falls back to the current month for malformed input', () => {
    expect(parsePeriod('not-a-period')).toEqual(parsePeriod(getCurrentPeriod()));
  });

  it('falls back to the current month for an out-of-range month', () => {
    expect(parsePeriod('2025-13')).toEqual(parsePeriod(getCurrentPeriod()));
  });

  it('falls back to the current month for a sub-1000 year that JavaScript Date would misread', () => {
    expect(parsePeriod('0099-01')).toEqual(parsePeriod(getCurrentPeriod()));
  });

  it('falls back to the current month when undefined', () => {
    expect(parsePeriod(undefined)).toEqual(parsePeriod(getCurrentPeriod()));
  });
});

describe('getMonthDateRange', () => {
  it('returns the first and last day padded to two digits', () => {
    expect(getMonthDateRange({ year: 2025, month: 3 })).toEqual({
      dateFrom: '2025-03-01',
      dateTo: '2025-03-31',
    });
  });

  it('resolves the leap-year last day of February', () => {
    expect(getMonthDateRange({ year: 2024, month: 2 })).toEqual({
      dateFrom: '2024-02-01',
      dateTo: '2024-02-29',
    });
  });

  it('resolves the non-leap-year last day of February', () => {
    expect(getMonthDateRange({ year: 2025, month: 2 }).dateTo).toBe('2025-02-28');
  });
});

describe('getPreviousPeriod', () => {
  it('steps back within a year', () => {
    expect(getPreviousPeriod({ year: 2025, month: 3 })).toBe('2025-02');
  });

  it('rolls over to the previous December in January', () => {
    expect(getPreviousPeriod({ year: 2025, month: 1 })).toBe('2024-12');
  });
});

describe('getNextPeriod', () => {
  it('steps forward within a year', () => {
    expect(getNextPeriod({ year: 2025, month: 3 })).toBe('2025-04');
  });

  it('rolls over to the next January in December', () => {
    expect(getNextPeriod({ year: 2025, month: 12 })).toBe('2026-01');
  });
});

describe('getCurrentPeriod', () => {
  it('returns a YYYY-MM string', () => {
    expect(getCurrentPeriod()).toMatch(/^\d{4}-\d{2}$/u);
  });
});
