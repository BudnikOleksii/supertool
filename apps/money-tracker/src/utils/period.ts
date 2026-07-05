export interface PeriodParts {
  year: number;
  month: number;
}

export interface MonthDateRange {
  dateFrom: string;
  dateTo: string;
}

const PERIOD_PATTERN = /^\d{4}-\d{2}$/u;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const MIN_YEAR = 1000;
const TWO_DIGITS = 2;
const YEAR_DIGITS = 4;
const FIRST_DAY_OF_MONTH = '01';
const MONTH_INDEX_OFFSET = 1;
const ADJACENT_STEP = 1;
const LAST_DAY_PROBE = 0;
const MONTHS_PER_YEAR = 12;
const PERIOD_START_INDEX = 0;
const PERIOD_LENGTH = 7;

const formatTwoDigits = (value: number): string => String(value).padStart(TWO_DIGITS, '0');

const formatYear = (year: number): string => String(year).padStart(YEAR_DIGITS, '0');

export const formatPeriod = ({ year, month }: PeriodParts): string =>
  `${formatYear(year)}-${formatTwoDigits(month)}`;

export const getCurrentPeriod = (): string => {
  const now = new Date();

  return formatPeriod({ year: now.getFullYear(), month: now.getMonth() + MONTH_INDEX_OFFSET });
};

export const checkIsValidPeriod = (value: string): boolean => {
  if (!PERIOD_PATTERN.test(value)) {
    return false;
  }

  const [yearPart, monthPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  return year >= MIN_YEAR && month >= FIRST_MONTH && month <= LAST_MONTH;
};

export const parsePeriod = (value: string | undefined): PeriodParts => {
  if (value === undefined || !checkIsValidPeriod(value)) {
    return parsePeriod(getCurrentPeriod());
  }

  const [yearPart, monthPart] = value.split('-');

  return { year: Number(yearPart), month: Number(monthPart) };
};

export const getPeriodFromDate = (date: string): string =>
  formatPeriod(parsePeriod(date.slice(PERIOD_START_INDEX, PERIOD_LENGTH)));

export const getMonthDateRange = ({ year, month }: PeriodParts): MonthDateRange => {
  const lastDay = new Date(year, month, LAST_DAY_PROBE).getDate();

  return {
    dateFrom: `${formatYear(year)}-${formatTwoDigits(month)}-${FIRST_DAY_OF_MONTH}`,
    dateTo: `${formatYear(year)}-${formatTwoDigits(month)}-${formatTwoDigits(lastDay)}`,
  };
};

export const getTrailingMonthsRange = (anchor: PeriodParts, monthCount: number): MonthDateRange => {
  const anchorIndex = anchor.year * MONTHS_PER_YEAR + (anchor.month - MONTH_INDEX_OFFSET);
  const startIndex = anchorIndex - (monthCount - ADJACENT_STEP);
  const startYear = Math.floor(startIndex / MONTHS_PER_YEAR);
  const startMonth = (startIndex % MONTHS_PER_YEAR) + MONTH_INDEX_OFFSET;

  return {
    dateFrom: `${formatYear(startYear)}-${formatTwoDigits(startMonth)}-${FIRST_DAY_OF_MONTH}`,
    dateTo: getMonthDateRange(anchor).dateTo,
  };
};

export const getPreviousPeriod = ({ year, month }: PeriodParts): string => {
  if (month === FIRST_MONTH) {
    return formatPeriod({ year: year - ADJACENT_STEP, month: LAST_MONTH });
  }

  return formatPeriod({ year, month: month - ADJACENT_STEP });
};

export const getNextPeriod = ({ year, month }: PeriodParts): string => {
  if (month === LAST_MONTH) {
    return formatPeriod({ year: year + ADJACENT_STEP, month: FIRST_MONTH });
  }

  return formatPeriod({ year, month: month + ADJACENT_STEP });
};

export const getPreviousYearPeriod = ({ year, month }: PeriodParts): string =>
  formatPeriod({ year: year - ADJACENT_STEP, month });

export const getNextYearPeriod = ({ year, month }: PeriodParts): string =>
  formatPeriod({ year: year + ADJACENT_STEP, month });
