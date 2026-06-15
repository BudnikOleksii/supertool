import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';
import type {
  SortOrder,
  TransactionListResponseDto,
  TransactionsFindAllData,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';

type FindAllQuery = NonNullable<TransactionsFindAllData['query']>;

export interface FetchTransactionsParams {
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy?: TransactionSortBy | undefined;
  sortOrder?: SortOrder | undefined;
}

export type FetchTransactionsResult =
  | { status: 'success'; transactions: TransactionListResponseDto }
  | { status: 'error' };

const buildFindAllQuery = (params: FetchTransactionsParams): FindAllQuery => {
  const query: FindAllQuery = {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: params.page,
    limit: params.limit,
  };

  if (params.type !== undefined) {
    query.type = params.type;
  }

  if (params.categoryId !== undefined) {
    query.categoryId = params.categoryId;
  }

  if (params.sortBy !== undefined) {
    query.sortBy = params.sortBy;
  }

  if (params.sortOrder !== undefined) {
    query.sortOrder = params.sortOrder;
  }

  return query;
};

export const fetchTransactions = cache(
  async (params: FetchTransactionsParams): Promise<FetchTransactionsResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await TransactionsApiService.transactionsFindAll({
      client: createServerApiClient({ cookieHeader }),
      query: buildFindAllQuery(params),
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', transactions: data };
  },
);
