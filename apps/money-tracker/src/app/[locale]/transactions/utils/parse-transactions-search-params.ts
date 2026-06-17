import { FIRST_PAGE, MAX_PAGE } from '@supertool/shared/constants/pagination';
import {
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  TRANSACTION_SORT_BY_LIST,
  TRANSACTION_SORT_ORDER_LIST,
} from '@supertool/shared/constants/transaction-sort';
import type {
  TransactionSortBy,
  TransactionSortOrder,
} from '@supertool/shared/constants/transaction-sort';
import type { TransactionType } from '@supertool/shared/generated/types.gen';

import { PAGE_SEARCH_PARAM } from '../../../../constants/search-params';
import { TRANSACTION_TYPE_LIST } from '../../../../constants/transaction';
import { normalizeSearchParam } from '../../../../utils/normalize-search-param';
import {
  CATEGORY_SEARCH_PARAM,
  SORT_BY_SEARCH_PARAM,
  SORT_ORDER_SEARCH_PARAM,
  TYPE_SEARCH_PARAM,
} from '../constants';

type RawSearchParams = Record<string, string | string[] | undefined>;

export interface TransactionsSearchParams {
  period: string;
  page: number;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: TransactionSortOrder;
}

const parsePage = (value: string | undefined): number => {
  const parsedPage = Number(value);

  if (!Number.isInteger(parsedPage) || parsedPage < FIRST_PAGE) {
    return FIRST_PAGE;
  }

  return Math.min(parsedPage, MAX_PAGE);
};

const parseType = (value: string | undefined): TransactionType | undefined =>
  TRANSACTION_TYPE_LIST.find((type) => type === value);

const parseCategoryId = (value: string | undefined): string | undefined =>
  value?.trim() || undefined;

const parseSortBy = (value: string | undefined): TransactionSortBy =>
  TRANSACTION_SORT_BY_LIST.find((sortBy) => sortBy === value) ?? DEFAULT_SORT_BY;

const parseSortOrder = (value: string | undefined): TransactionSortOrder =>
  TRANSACTION_SORT_ORDER_LIST.find((sortOrder) => sortOrder === value) ?? DEFAULT_SORT_ORDER;

export const parseTransactionsSearchParams = (
  searchParams: RawSearchParams,
  period: string,
): TransactionsSearchParams => ({
  period,
  page: parsePage(normalizeSearchParam(searchParams[PAGE_SEARCH_PARAM])),
  type: parseType(normalizeSearchParam(searchParams[TYPE_SEARCH_PARAM])),
  categoryId: parseCategoryId(normalizeSearchParam(searchParams[CATEGORY_SEARCH_PARAM])),
  sortBy: parseSortBy(normalizeSearchParam(searchParams[SORT_BY_SEARCH_PARAM])),
  sortOrder: parseSortOrder(normalizeSearchParam(searchParams[SORT_ORDER_SEARCH_PARAM])),
});
