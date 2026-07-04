import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { AnalyticsApiService } from '@supertool/shared/generated/sdk.gen';
import type { DailySpendingResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchDailySpendingParams {
  dateFrom: string;
  dateTo: string;
}

export type FetchDailySpendingResult =
  | { status: 'success'; dailySpending: DailySpendingResponseDto }
  | { status: 'error' };

export const fetchDailySpending = cache(
  async (params: FetchDailySpendingParams): Promise<FetchDailySpendingResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await AnalyticsApiService.analyticsGetDailySpending({
      client: createServerApiClient({ cookieHeader }),
      query: { dateFrom: params.dateFrom, dateTo: params.dateTo },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', dailySpending: data };
  },
);
