import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';
import type { TransactionListResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchTransactionsParams {
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

export type FetchTransactionsResult =
  | { status: 'success'; transactions: TransactionListResponseDto }
  | { status: 'error' };

export const fetchTransactions = cache(
  async (params: FetchTransactionsParams): Promise<FetchTransactionsResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await TransactionsApiService.transactionsFindAll({
      client: createServerApiClient({ cookieHeader }),
      query: {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        page: params.page,
        limit: params.limit,
      },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', transactions: data };
  },
);
