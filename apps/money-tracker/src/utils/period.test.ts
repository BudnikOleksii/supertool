import { describe, expect, it } from 'vitest';

import {
  checkIsValidPeriod,
  getCurrentPeriod,
  getMonthDateRange,
  getNextPeriod,
  getNextYearPeriod,
  getPeriodFromDate,
  getPreviousPeriod,
  getPreviousYearPeriod,
  getTrailingMonthsRange,
  parsePeriod,
} from './period';

describe('checkIsValidPeriod', () => {
  it('accepts a well-formed in-range period', () => {
    expect(checkIsValidPeriod('2025-03')).toBe(true);
  });

  it('rejects a malformed pattern', () => {
    expect(checkIsValidPeriod('not-a-period')).toBe(false);
    expect(checkIsValidPeriod('2025-3')).toBe(false);
  });

  it('rejects an out-of-range month', () => {
    expect(checkIsValidPeriod('2025-13')).toBe(false);
    expect(checkIsValidPeriod('2025-00')).toBe(false);
  });

  it('rejects a sub-1000 year that JavaScript Date would misread', () => {
    expect(checkIsValidPeriod('0099-01')).toBe(false);
  });
});

describe('getPeriodFromDate', () => {
  it('extracts the YYYY-MM period from a YYYY-MM-DD date', () => {
    expect(getPeriodFromDate('2025-02-03')).toBe('2025-02');
  });

  it('keeps the year boundary intact for a December date', () => {
    expect(getPeriodFromDate('2021-12-31')).toBe('2021-12');
  });
});

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

const WINDOW_MONTHS = 12;
const QUARTER_MONTHS = 3;
const SINGLE_MONTH = 1;

describe('getTrailingMonthsRange', () => {
  it('spans a 12-month window ending at the anchor, crossing the year boundary', () => {
    expect(getTrailingMonthsRange({ year: 2025, month: 3 }, WINDOW_MONTHS)).toEqual({
      dateFrom: '2024-04-01',
      dateTo: '2025-03-31',
    });
  });

  it('stays within the same year for a window that does not cross January', () => {
    expect(getTrailingMonthsRange({ year: 2025, month: 12 }, QUARTER_MONTHS)).toEqual({
      dateFrom: '2025-10-01',
      dateTo: '2025-12-31',
    });
  });

  it('resolves the anchor last day for a leap-year February anchor', () => {
    expect(getTrailingMonthsRange({ year: 2024, month: 2 }, WINDOW_MONTHS)).toEqual({
      dateFrom: '2023-03-01',
      dateTo: '2024-02-29',
    });
  });

  it('returns the anchor month itself for a single-month window', () => {
    expect(getTrailingMonthsRange({ year: 2025, month: 6 }, SINGLE_MONTH)).toEqual({
      dateFrom: '2025-06-01',
      dateTo: '2025-06-30',
    });
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

describe('getPreviousYearPeriod', () => {
  it('steps back one year while preserving the month', () => {
    expect(getPreviousYearPeriod({ year: 2024, month: 5 })).toBe('2023-05');
  });

  it('preserves December when jumping back a year', () => {
    expect(getPreviousYearPeriod({ year: 2025, month: 12 })).toBe('2024-12');
  });

  it('preserves January when jumping back a year', () => {
    expect(getPreviousYearPeriod({ year: 2025, month: 1 })).toBe('2024-01');
  });
});

describe('getNextYearPeriod', () => {
  it('steps forward one year while preserving the month', () => {
    expect(getNextYearPeriod({ year: 2024, month: 5 })).toBe('2025-05');
  });

  it('preserves December when jumping forward a year', () => {
    expect(getNextYearPeriod({ year: 2025, month: 12 })).toBe('2026-12');
  });

  it('preserves January when jumping forward a year', () => {
    expect(getNextYearPeriod({ year: 2025, month: 1 })).toBe('2026-01');
  });
});

describe('getCurrentPeriod', () => {
  it('returns a YYYY-MM string', () => {
    expect(getCurrentPeriod()).toMatch(/^\d{4}-\d{2}$/u);
  });
});
