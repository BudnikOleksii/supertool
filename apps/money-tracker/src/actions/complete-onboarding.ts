'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { UsersApiService } from '@supertool/shared/generated/sdk.gen';

import { ROUTES } from '../constants/routes';

export const completeOnboarding = async (): Promise<ActionState> => {
  const cookieStore = await cookies();
  const { data, error } = await UsersApiService.usersUpdateMe({
    client: createServerApiClient({ cookieHeader: cookieStore.toString() }),
    body: { onboardingCompleted: true },
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  revalidatePath(ROUTES.home, 'layout');

  return { status: 'success' };
};
