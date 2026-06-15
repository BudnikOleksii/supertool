const DATE_PART_RADIX = 10;
const MONTH_INDEX_OFFSET = 1;
const DAY_STEP = 1;
const DATE_PART_LENGTH = 2;
const YEAR_LENGTH = 4;
const DATE_PAD_CHAR = '0';

export const getNextCalendarDate = (date: string): string => {
  const [yearPart = '', monthPart = '', dayPart = ''] = date.split('-');
  const year = Number.parseInt(yearPart, DATE_PART_RADIX);
  const month = Number.parseInt(monthPart, DATE_PART_RADIX);
  const day = Number.parseInt(dayPart, DATE_PART_RADIX);
  const next = new Date(Date.UTC(year, month - MONTH_INDEX_OFFSET, day + DAY_STEP));

  const nextYear = String(next.getUTCFullYear()).padStart(YEAR_LENGTH, DATE_PAD_CHAR);
  const nextMonth = String(next.getUTCMonth() + MONTH_INDEX_OFFSET).padStart(
    DATE_PART_LENGTH,
    DATE_PAD_CHAR,
  );
  const nextDay = String(next.getUTCDate()).padStart(DATE_PART_LENGTH, DATE_PAD_CHAR);

  return `${nextYear}-${nextMonth}-${nextDay}`;
};
