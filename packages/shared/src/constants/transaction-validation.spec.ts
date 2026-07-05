import { describe, expect, it } from 'vitest';

import { checkIsCalendarDate, checkIsOrderedDateRange } from './transaction-validation';

describe('checkIsCalendarDate', () => {
  it('accepts a real calendar date', () => {
    expect(checkIsCalendarDate('2025-02-28')).toBe(true);
  });

  it('accepts a leap-year February 29th', () => {
    expect(checkIsCalendarDate('2024-02-29')).toBe(true);
  });

  it('rejects a non-leap-year February 29th', () => {
    expect(checkIsCalendarDate('2025-02-29')).toBe(false);
  });

  it('rejects a day past the end of the month', () => {
    expect(checkIsCalendarDate('2025-02-30')).toBe(false);
    expect(checkIsCalendarDate('2025-04-31')).toBe(false);
  });

  it('rejects an out-of-range month', () => {
    expect(checkIsCalendarDate('2025-13-01')).toBe(false);
    expect(checkIsCalendarDate('2025-00-10')).toBe(false);
  });

  it('rejects a zero day', () => {
    expect(checkIsCalendarDate('2025-01-00')).toBe(false);
  });

  it('rejects a value that does not match the calendar-date format', () => {
    expect(checkIsCalendarDate('2025-2-3')).toBe(false);
    expect(checkIsCalendarDate('03-02-2025')).toBe(false);
    expect(checkIsCalendarDate('not-a-date')).toBe(false);
  });
});

describe('checkIsOrderedDateRange', () => {
  it('accepts a window where dateFrom precedes dateTo', () => {
    expect(checkIsOrderedDateRange('2025-02-01', '2025-02-28')).toBe(true);
  });

  it('accepts a window where the bounds are equal', () => {
    expect(checkIsOrderedDateRange('2025-02-01', '2025-02-01')).toBe(true);
  });

  it('rejects a reversed window', () => {
    expect(checkIsOrderedDateRange('2025-02-28', '2025-02-01')).toBe(false);
  });
});
