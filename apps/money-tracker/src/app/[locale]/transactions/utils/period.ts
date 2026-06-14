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
const TWO_DIGITS = 2;
const FIRST_DAY_OF_MONTH = '01';
const MONTH_INDEX_OFFSET = 1;
const ADJACENT_STEP = 1;
const LAST_DAY_PROBE = 0;

const formatTwoDigits = (value: number): string => String(value).padStart(TWO_DIGITS, '0');

export const formatPeriod = ({ year, month }: PeriodParts): string =>
  `${String(year)}-${formatTwoDigits(month)}`;

export const getCurrentPeriod = (): string => {
  const now = new Date();

  return formatPeriod({ year: now.getFullYear(), month: now.getMonth() + MONTH_INDEX_OFFSET });
};

export const parsePeriod = (value: string | undefined): PeriodParts => {
  if (value === undefined || !PERIOD_PATTERN.test(value)) {
    return parsePeriod(getCurrentPeriod());
  }

  const [yearPart, monthPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (month < FIRST_MONTH || month > LAST_MONTH) {
    return parsePeriod(getCurrentPeriod());
  }

  return { year, month };
};

export const getMonthDateRange = ({ year, month }: PeriodParts): MonthDateRange => {
  const lastDay = new Date(year, month, LAST_DAY_PROBE).getDate();

  return {
    dateFrom: `${String(year)}-${formatTwoDigits(month)}-${FIRST_DAY_OF_MONTH}`,
    dateTo: `${String(year)}-${formatTwoDigits(month)}-${formatTwoDigits(lastDay)}`,
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
