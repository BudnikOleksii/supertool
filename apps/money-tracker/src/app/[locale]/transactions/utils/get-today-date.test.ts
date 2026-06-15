import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTodayDate } from './get-today-date';

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MONTH_OFFSET = 1;
const DATE_PART_LENGTH = 2;
const DATE_PAD_CHAR = '0';
const FROZEN_YEAR = 2025;
const FROZEN_MONTH_INDEX = 2;
const FROZEN_DAY = 15;
const FROZEN_HOUR = 12;
const FROZEN_NOW = new Date(FROZEN_YEAR, FROZEN_MONTH_INDEX, FROZEN_DAY, FROZEN_HOUR);

describe('getTodayDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a calendar date string in YYYY-MM-DD format', () => {
    expect(getTodayDate()).toMatch(CALENDAR_DATE_PATTERN);
  });

  it('matches today computed from local date parts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

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
