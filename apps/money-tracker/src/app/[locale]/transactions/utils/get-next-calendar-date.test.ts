import { describe, expect, it } from 'vitest';

import { getNextCalendarDate } from './get-next-calendar-date';

describe('getNextCalendarDate', () => {
  it('advances by a single day within a month', () => {
    expect(getNextCalendarDate('2025-02-03')).toBe('2025-02-04');
  });

  it('rolls over to the first day of the next month', () => {
    expect(getNextCalendarDate('2025-02-28')).toBe('2025-03-01');
  });

  it('rolls over to the next year', () => {
    expect(getNextCalendarDate('2025-12-31')).toBe('2026-01-01');
  });

  it('handles a leap-year February 29th', () => {
    expect(getNextCalendarDate('2024-02-29')).toBe('2024-03-01');
  });
});
