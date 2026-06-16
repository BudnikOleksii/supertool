import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { AnalyticsApiService } from '@supertool/shared/generated/sdk.gen';
import type { TrendResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchMonthlyTrendParams {
  dateFrom: string;
  dateTo: string;
}

export type FetchMonthlyTrendResult =
  | { status: 'success'; trend: TrendResponseDto }
  | { status: 'error' };

export const fetchMonthlyTrend = cache(
  async (params: FetchMonthlyTrendParams): Promise<FetchMonthlyTrendResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await AnalyticsApiService.analyticsGetMonthlyTrend({
      client: createServerApiClient({ cookieHeader }),
      query: { dateFrom: params.dateFrom, dateTo: params.dateTo },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', trend: data };
  },
);
