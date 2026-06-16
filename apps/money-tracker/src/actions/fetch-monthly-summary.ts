import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { AnalyticsApiService } from '@supertool/shared/generated/sdk.gen';
import type { MonthlySummaryResponseDto } from '@supertool/shared/generated/types.gen';

export interface FetchMonthlySummaryParams {
  dateFrom: string;
  dateTo: string;
}

export type FetchMonthlySummaryResult =
  | { status: 'success'; summary: MonthlySummaryResponseDto }
  | { status: 'error' };

export const fetchMonthlySummary = cache(
  async (params: FetchMonthlySummaryParams): Promise<FetchMonthlySummaryResult> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data, error } = await AnalyticsApiService.analyticsGetMonthlySummary({
      client: createServerApiClient({ cookieHeader }),
      query: { dateFrom: params.dateFrom, dateTo: params.dateTo },
    });

    if (error || !data) {
      return { status: 'error' };
    }

    return { status: 'success', summary: data };
  },
);
