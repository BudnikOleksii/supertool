import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { AnalyticsApiService } from '@supertool/shared/generated/sdk.gen';
import type { CategoryBreakdownResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchCategoryBreakdownParams {
  dateFrom: string;
  dateTo: string;
}

export type FetchCategoryBreakdownResult =
  | { status: 'success'; breakdown: CategoryBreakdownResponseDto }
  | { status: 'error' };

export const fetchCategoryBreakdown = cache(
  async (params: FetchCategoryBreakdownParams): Promise<FetchCategoryBreakdownResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await AnalyticsApiService.analyticsGetCategoryBreakdown({
      client: createServerApiClient({ cookieHeader }),
      query: { dateFrom: params.dateFrom, dateTo: params.dateTo },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', breakdown: data };
  },
);
