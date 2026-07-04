import { CALENDAR_DATE_PATTERN } from '@supertool/shared/constants/transaction-validation';
import type { TransactionType } from '@supertool/shared/generated/types.gen';

import type { MonthDateRange } from './period';

import {
  DATE_FROM_SEARCH_PARAM,
  DATE_TO_SEARCH_PARAM,
  TYPE_SEARCH_PARAM,
} from '../constants/search-params';
import { TRANSACTION_TYPE_LIST } from '../constants/transaction';
import { normalizeSearchParam } from './normalize-search-param';
import { getMonthDateRange, parsePeriod } from './period';
import { resolveDefaultPeriod } from './resolve-default-period';

type RawSearchParams = Record<string, string | string[] | undefined>;

export interface DashboardSearchParams {
  dateFrom: string;
  dateTo: string;
  type?: TransactionType | undefined;
}

const parseRange = (
  dateFrom: string | undefined,
  dateTo: string | undefined,
): MonthDateRange | undefined => {
  if (dateFrom === undefined || dateTo === undefined) {
    return undefined;
  }

  if (!CALENDAR_DATE_PATTERN.test(dateFrom) || !CALENDAR_DATE_PATTERN.test(dateTo)) {
    return undefined;
  }

  if (dateTo < dateFrom) {
    return undefined;
  }

  return { dateFrom, dateTo };
};

const parseType = (value: string | undefined): TransactionType | undefined =>
  TRANSACTION_TYPE_LIST.find((type) => type === value);

export const parseDashboardSearchParams = async (
  searchParams: RawSearchParams,
): Promise<DashboardSearchParams> => {
  const type = parseType(normalizeSearchParam(searchParams[TYPE_SEARCH_PARAM]));
  const range = parseRange(
    normalizeSearchParam(searchParams[DATE_FROM_SEARCH_PARAM]),
    normalizeSearchParam(searchParams[DATE_TO_SEARCH_PARAM]),
  );

  if (range !== undefined) {
    return { dateFrom: range.dateFrom, dateTo: range.dateTo, type };
  }

  const defaultRange = getMonthDateRange(parsePeriod(await resolveDefaultPeriod(undefined)));

  return { dateFrom: defaultRange.dateFrom, dateTo: defaultRange.dateTo, type };
};
