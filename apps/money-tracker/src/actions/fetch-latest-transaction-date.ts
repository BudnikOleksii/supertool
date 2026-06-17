import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { FIRST_PAGE } from '@supertool/shared/constants/pagination';
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@supertool/shared/constants/transaction-sort';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

const LATEST_LIMIT = 1;
const FIRST_TRANSACTION_INDEX = 0;

export const fetchLatestTransactionDate = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { data, error } = await TransactionsApiService.transactionsFindAll({
    client: createServerApiClient({ cookieHeader }),
    query: {
      page: FIRST_PAGE,
      limit: LATEST_LIMIT,
      sortBy: DEFAULT_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
    },
  });

  if (error || !data) {
    return null;
  }

  return data.data[FIRST_TRANSACTION_INDEX]?.date ?? null;
});
