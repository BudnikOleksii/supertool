import { FIRST_PAGE } from '@supertool/shared/constants/pagination';
import type {
  SortOrder,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';

import { PAGE_SEARCH_PARAM, PERIOD_SEARCH_PARAM } from '../../../../constants/search-params';
import {
  CATEGORY_SEARCH_PARAM,
  SEARCH_SEARCH_PARAM,
  SORT_BY_SEARCH_PARAM,
  SORT_ORDER_SEARCH_PARAM,
  TYPE_SEARCH_PARAM,
} from '../constants';

export interface TransactionViewParams {
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  search?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
}

const buildViewQuery = (view: TransactionViewParams): Record<string, string> => {
  const query: Record<string, string> = {
    [SORT_BY_SEARCH_PARAM]: view.sortBy,
    [SORT_ORDER_SEARCH_PARAM]: view.sortOrder,
  };

  if (view.type !== undefined) {
    query[TYPE_SEARCH_PARAM] = view.type;
  }

  if (view.categoryId !== undefined) {
    query[CATEGORY_SEARCH_PARAM] = view.categoryId;
  }

  if (view.search !== undefined) {
    query[SEARCH_SEARCH_PARAM] = view.search;
  }

  return query;
};

export const buildTransactionsRedirectQuery = (
  period: string,
  page: number,
  view?: TransactionViewParams,
): Record<string, string> => ({
  [PERIOD_SEARCH_PARAM]: period,
  ...(page > FIRST_PAGE ? { [PAGE_SEARCH_PARAM]: String(page) } : {}),
  ...(view === undefined ? {} : buildViewQuery(view)),
});
