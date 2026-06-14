import {
  FIRST_ELEMENT_INDEX,
  FIRST_PAGE,
  PAGE_SEARCH_PARAM,
  PERIOD_SEARCH_PARAM,
} from '../constants';
import { formatPeriod, getCurrentPeriod, parsePeriod } from './period';

type RawSearchParams = Record<string, string | string[] | undefined>;

export interface TransactionsSearchParams {
  period: string;
  page: number;
}

const normalizeParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[FIRST_ELEMENT_INDEX] : value;

const parsePage = (value: string | undefined): number => {
  const parsedPage = Number(value);

  if (!Number.isInteger(parsedPage) || parsedPage < FIRST_PAGE) {
    return FIRST_PAGE;
  }

  return parsedPage;
};

export const parseTransactionsSearchParams = (
  searchParams: RawSearchParams,
): TransactionsSearchParams => {
  const rawPeriod = normalizeParam(searchParams[PERIOD_SEARCH_PARAM]);
  const periodParts = parsePeriod(rawPeriod ?? getCurrentPeriod());

  return {
    period: formatPeriod(periodParts),
    page: parsePage(normalizeParam(searchParams[PAGE_SEARCH_PARAM])),
  };
};
