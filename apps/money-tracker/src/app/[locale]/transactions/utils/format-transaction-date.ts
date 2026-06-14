const MONTH_OFFSET = 1;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (locale: string): Intl.DateTimeFormat => {
  const cachedFormatter = dateFormatterCache.get(locale);

  if (cachedFormatter !== undefined) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  dateFormatterCache.set(locale, formatter);

  return formatter;
};

export const formatTransactionDate = (isoDate: string, locale: string): string => {
  if (!CALENDAR_DATE_PATTERN.test(isoDate)) {
    return isoDate;
  }

  const [yearPart, monthPart, dayPart] = isoDate.split('-');
  const date = new Date(Number(yearPart), Number(monthPart) - MONTH_OFFSET, Number(dayPart));

  return getDateFormatter(locale).format(date);
};
