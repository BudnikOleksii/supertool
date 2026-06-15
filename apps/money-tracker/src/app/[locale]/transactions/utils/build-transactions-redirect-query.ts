import { FIRST_PAGE, PAGE_SEARCH_PARAM, PERIOD_SEARCH_PARAM } from '../constants';

export const buildTransactionsRedirectQuery = (
  period: string,
  page: number,
): Record<string, string> =>
  page > FIRST_PAGE
    ? { [PERIOD_SEARCH_PARAM]: period, [PAGE_SEARCH_PARAM]: String(page) }
    : { [PERIOD_SEARCH_PARAM]: period };
