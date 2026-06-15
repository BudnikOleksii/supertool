import { describe, expect, it } from 'vitest';

import { getTodayDate } from './get-today-date';

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MONTH_OFFSET = 1;
const DATE_PART_LENGTH = 2;
const DATE_PAD_CHAR = '0';

describe('getTodayDate', () => {
  it('returns a calendar date string in YYYY-MM-DD format', () => {
    expect(getTodayDate()).toMatch(CALENDAR_DATE_PATTERN);
  });

  it('matches today computed from local date parts', () => {
    const now = new Date();
    const expectedYear = String(now.getFullYear());
    const expectedMonth = String(now.getMonth() + MONTH_OFFSET).padStart(
      DATE_PART_LENGTH,
      DATE_PAD_CHAR,
    );
    const expectedDay = String(now.getDate()).padStart(DATE_PART_LENGTH, DATE_PAD_CHAR);

    expect(getTodayDate()).toBe(`${expectedYear}-${expectedMonth}-${expectedDay}`);
  });
});
