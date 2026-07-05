const DATE_PAD_LENGTH = 2;
const MONTH_MIN = 1;
const MONTH_MAX = 12;
const DAY_MIN = 1;
const DAY_MAX = 31;

const YEAR_PATTERN = /^\d{4}$/u;
const FIELD_PATTERN = /^\d+$/u;
const ISO_DATE_PATTERN = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;

const checkIsInRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

const checkIsCalendarFields = (year: string, month: string, day: string): boolean =>
  YEAR_PATTERN.test(year) &&
  FIELD_PATTERN.test(month) &&
  FIELD_PATTERN.test(day) &&
  checkIsInRange(Number(month), MONTH_MIN, MONTH_MAX) &&
  checkIsInRange(Number(day), DAY_MIN, DAY_MAX);

const parseIsoDate = (datePart: string): string | undefined => {
  const groups = ISO_DATE_PATTERN.exec(datePart)?.groups;

  if (groups?.year === undefined || groups.month === undefined || groups.day === undefined) {
    return undefined;
  }

  return checkIsCalendarFields(groups.year, groups.month, groups.day)
    ? `${groups.year}-${groups.month}-${groups.day}`
    : undefined;
};

export const parseSeedDate = (sourceDate: string): string => {
  const [datePart] = sourceDate.trim().split(' ');

  const isoDate = parseIsoDate(datePart ?? '');

  if (isoDate !== undefined) {
    return isoDate;
  }

  const [month, day, year] = (datePart ?? '').split('/');

  if (
    month === undefined ||
    day === undefined ||
    year === undefined ||
    !checkIsCalendarFields(year, month, day)
  ) {
    throw new Error(`Unparseable seed date: ${sourceDate}`);
  }

  return `${year}-${month.padStart(DATE_PAD_LENGTH, '0')}-${day.padStart(DATE_PAD_LENGTH, '0')}`;
};
