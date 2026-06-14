import { cookies } from 'next/headers';
import { cache } from 'react';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { UsersApiService } from '@supertool/shared/generated/sdk.gen';
import type { UserResponseDto } from '@supertool/shared/generated/types.gen';

export const fetchProfile = cache(async (): Promise<UserResponseDto | null> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { data } = await UsersApiService.usersMe({
    client: createServerApiClient({ cookieHeader }),
  });

  return data ?? null;
});
