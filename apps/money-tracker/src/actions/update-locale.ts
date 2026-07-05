'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';
import { UsersApiService } from '@supertool/shared/generated/sdk.gen';

import { ROUTES } from '../constants/routes';

const localeSchema = z.enum(LOCALE_CODE_LIST);

export const updateLocale = async (locale: string): Promise<ActionState> => {
  const parsed = localeSchema.safeParse(locale);

  if (!parsed.success) {
    return { status: 'error', code: ErrorCode.ValidationError };
  }

  const cookieStore = await cookies();
  const { data, error } = await UsersApiService.usersUpdateMe({
    client: createServerApiClient({ cookieHeader: cookieStore.toString() }),
    body: { locale: parsed.data },
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  revalidatePath(ROUTES.home, 'layout');

  return { status: 'success' };
};
