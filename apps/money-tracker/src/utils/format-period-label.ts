import type { PeriodParts } from './period';

const MONTH_OFFSET = 1;
const FIRST_DAY = 1;

const periodLabelFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getPeriodLabelFormatter = (locale: string): Intl.DateTimeFormat => {
  const cachedFormatter = periodLabelFormatterCache.get(locale);

  if (cachedFormatter !== undefined) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  periodLabelFormatterCache.set(locale, formatter);

  return formatter;
};

export const formatPeriodLabel = ({ year, month }: PeriodParts, locale: string): string =>
  getPeriodLabelFormatter(locale).format(new Date(year, month - MONTH_OFFSET, FIRST_DAY));
