export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export const POSITIVE_AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)\d{1,12}(?:\.\d{1,2})?$/u;

const DATE_PART_RADIX = 10;
const MONTH_INDEX_OFFSET = 1;

export const checkIsCalendarDate = (value: string): boolean => {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearPart = '', monthPart = '', dayPart = ''] = value.split('-');
  const year = Number.parseInt(yearPart, DATE_PART_RADIX);
  const month = Number.parseInt(monthPart, DATE_PART_RADIX);
  const day = Number.parseInt(dayPart, DATE_PART_RADIX);
  const date = new Date(Date.UTC(year, month - MONTH_INDEX_OFFSET, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - MONTH_INDEX_OFFSET &&
    date.getUTCDate() === day
  );
};

export const checkIsOrderedDateRange = (dateFrom: string, dateTo: string): boolean =>
  dateFrom <= dateTo;

const MILLISECONDS_PER_DAY = 86_400_000;
const INCLUSIVE_DAY_OFFSET = 1;

const parseCalendarDateToUtcMs = (value: string): number => {
  const [yearPart = '', monthPart = '', dayPart = ''] = value.split('-');

  return Date.UTC(
    Number.parseInt(yearPart, DATE_PART_RADIX),
    Number.parseInt(monthPart, DATE_PART_RADIX) - MONTH_INDEX_OFFSET,
    Number.parseInt(dayPart, DATE_PART_RADIX),
  );
};

export const getInclusiveDaySpan = (dateFrom: string, dateTo: string): number =>
  (parseCalendarDateToUtcMs(dateTo) - parseCalendarDateToUtcMs(dateFrom)) / MILLISECONDS_PER_DAY +
  INCLUSIVE_DAY_OFFSET;

export const checkIsBoundedDateRange = (
  dateFrom: string,
  dateTo: string,
  maxDays: number,
): boolean => getInclusiveDaySpan(dateFrom, dateTo) <= maxDays;
