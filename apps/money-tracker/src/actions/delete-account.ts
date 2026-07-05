'use server';

import { getLocale } from 'next-intl/server';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { UsersApiService } from '@supertool/shared/generated/sdk.gen';

import { ROUTES } from '../constants/routes';

const BETTER_AUTH_COOKIE_PREFIX = 'better-auth';

export const deleteAccount = async (): Promise<ActionState> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { error } = await UsersApiService.usersDeleteMe({
    client: createServerApiClient({ cookieHeader }),
  });

  if (error) {
    return { status: 'error', code: error.code ?? UNKNOWN_ERROR_CODE, message: error.message };
  }

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(BETTER_AUTH_COOKIE_PREFIX)) {
      cookieStore.delete(cookie.name);
    }
  }

  const locale = await getLocale();

  return redirect({ href: ROUTES.signIn, locale });
};
