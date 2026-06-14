import { describe, expect, it } from 'vitest';

import { formatTransactionDate } from './format-transaction-date';

describe('formatTransactionDate', () => {
  it('formats a calendar date string in the requested locale', () => {
    expect(formatTransactionDate('2025-02-03', 'en')).toBe('Feb 3, 2025');
  });

  it('does not shift the day across timezones for the first of the month', () => {
    expect(formatTransactionDate('2025-03-01', 'en')).toBe('Mar 1, 2025');
  });

  it('formats the date in the Ukrainian locale', () => {
    const actual = formatTransactionDate('2025-02-03', 'uk');

    expect(actual).toContain('2025');
    expect(actual).toContain('р.');
  });

  it('returns the raw value when the input is not a calendar date', () => {
    expect(formatTransactionDate('not-a-date', 'uk')).toBe('not-a-date');
  });
});
