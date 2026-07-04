import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { AnalyticsApiService } from '@supertool/shared/generated/sdk.gen';
import type { TopCategoriesResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchTopCategoriesParams {
  dateFrom: string;
  dateTo: string;
  limit: number;
}

export type FetchTopCategoriesResult =
  | { status: 'success'; topCategories: TopCategoriesResponseDto }
  | { status: 'error' };

export const fetchTopCategories = cache(
  async (params: FetchTopCategoriesParams): Promise<FetchTopCategoriesResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await AnalyticsApiService.analyticsGetTopCategories({
      client: createServerApiClient({ cookieHeader }),
      query: { dateFrom: params.dateFrom, dateTo: params.dateTo, limit: params.limit },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', topCategories: data };
  },
);
