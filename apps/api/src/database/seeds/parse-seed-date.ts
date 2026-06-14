const DATE_PAD_LENGTH = 2;
const MONTH_MIN = 1;
const MONTH_MAX = 12;
const DAY_MIN = 1;
const DAY_MAX = 31;

const YEAR_PATTERN = /^\d{4}$/u;
const FIELD_PATTERN = /^\d+$/u;

const checkIsInRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

export const parseSeedDate = (sourceDate: string): string => {
  const [datePart] = sourceDate.trim().split(' ');
  const [month, day, year] = (datePart ?? '').split('/');

  if (month === undefined || day === undefined || year === undefined) {
    throw new Error(`Unparseable seed date: ${sourceDate}`);
  }

  const checkIsValid =
    YEAR_PATTERN.test(year) &&
    FIELD_PATTERN.test(month) &&
    FIELD_PATTERN.test(day) &&
    checkIsInRange(Number(month), MONTH_MIN, MONTH_MAX) &&
    checkIsInRange(Number(day), DAY_MIN, DAY_MAX);

  if (!checkIsValid) {
    throw new Error(`Unparseable seed date: ${sourceDate}`);
  }

  return `${year}-${month.padStart(DATE_PAD_LENGTH, '0')}-${day.padStart(DATE_PAD_LENGTH, '0')}`;
};
