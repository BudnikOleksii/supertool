import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { AnalyticsApiService } from '@supertool/shared/generated/sdk.gen';
import type { ByCategoryResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchTransactionsByCategoryParams {
  dateFrom: string;
  dateTo: string;
}

export type FetchTransactionsByCategoryResult =
  | { status: 'success'; byCategory: ByCategoryResponseDto }
  | { status: 'error' };

export const fetchTransactionsByCategory = cache(
  async (params: FetchTransactionsByCategoryParams): Promise<FetchTransactionsByCategoryResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await AnalyticsApiService.analyticsGetByCategory({
      client: createServerApiClient({ cookieHeader }),
      query: { dateFrom: params.dateFrom, dateTo: params.dateTo },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', byCategory: data };
  },
);
