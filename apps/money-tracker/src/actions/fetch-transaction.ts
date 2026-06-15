import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';
import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

export const fetchTransaction = cache(
  async (id: string): Promise<TransactionResponseDto | null> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const { data } = await TransactionsApiService.transactionsFindOne({
      client: createServerApiClient({ cookieHeader }),
      path: { id },
    });

    return data ?? null;
  },
);
