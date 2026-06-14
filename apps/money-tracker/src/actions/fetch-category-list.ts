import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { TransactionCategoriesApiService } from '@supertool/shared/generated/sdk.gen';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

export const fetchCategoryList = cache(async (): Promise<CategoryResponseDto[]> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { data } = await TransactionCategoriesApiService.transactionCategoriesFindAll({
    client: createServerApiClient({ cookieHeader }),
  });

  return data ?? [];
});
