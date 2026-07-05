import { describe, expect, it } from 'vitest';

import { parseSeedDate } from './parse-seed-date';

describe('parseSeedDate', () => {
  it('reorders MM/DD/YYYY HH:MM:SS into a YYYY-MM-DD calendar date', () => {
    const actual = parseSeedDate('02/03/2025 15:41:17');

    expect(actual).toBe('2025-02-03');
  });

  it('pads single-digit month and day fields', () => {
    const actual = parseSeedDate('1/5/2025 06:17:16');

    expect(actual).toBe('2025-01-05');
  });

  it('preserves the day field at the end of the month', () => {
    const actual = parseSeedDate('01/31/2025 15:21:55');

    expect(actual).toBe('2025-01-31');
  });

  it('accepts an already-ISO YYYY-MM-DD date so exports round-trip through import', () => {
    expect(parseSeedDate('2025-02-03')).toBe('2025-02-03');
  });

  it('accepts an ISO date at the end of the month', () => {
    expect(parseSeedDate('2025-01-31')).toBe('2025-01-31');
  });

  it('throws on an ISO date with an out-of-range month', () => {
    expect(() => parseSeedDate('2025-13-01')).toThrowError(/Unparseable seed date/u);
  });

  it('throws on an unparseable date instead of guessing', () => {
    expect(() => parseSeedDate('not-a-date')).toThrowError(/Unparseable seed date/u);
  });

  it('throws on a two-digit year instead of storing a year-25-AD date', () => {
    expect(() => parseSeedDate('2/3/25 15:41:17')).toThrowError(/Unparseable seed date/u);
  });

  it('throws on an out-of-range month', () => {
    expect(() => parseSeedDate('13/05/2025 00:00:00')).toThrowError(/Unparseable seed date/u);
  });

  it('throws on a non-numeric field', () => {
    expect(() => parseSeedDate('aa/bb/cccc 00:00:00')).toThrowError(/Unparseable seed date/u);
  });
});
