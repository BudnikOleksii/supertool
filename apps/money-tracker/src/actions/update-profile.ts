'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { UsersApiService } from '@supertool/shared/generated/sdk.gen';

import type { ProfileFormValues } from '../app/[locale]/settings/constants/profile-form-schema';

import { profileFormSchema } from '../app/[locale]/settings/constants/profile-form-schema';
import { ROUTES } from '../constants/routes';

const revalidateProfileViews = (): void => {
  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.home, 'layout');
};

export const updateProfile = async (values: ProfileFormValues): Promise<ActionState> => {
  const parsed = profileFormSchema.safeParse(values);

  if (!parsed.success) {
    return { status: 'error', code: 'VALIDATION_ERROR' };
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { data, error } = await UsersApiService.usersUpdateMe({
    client: createServerApiClient({ cookieHeader }),
    body: {
      name: parsed.data.name,
      locale: parsed.data.locale,
      ...(parsed.data.defaultCurrency !== undefined && {
        defaultCurrency: parsed.data.defaultCurrency,
      }),
    },
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? 'UNKNOWN', message: error?.message };
  }

  revalidateProfileViews();

  return { status: 'success' };
};
