import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { UserResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchProfile } from '../actions/fetch-profile';
import { ROUTES } from '../constants/routes';

export const resolveOnboardedProfile = async (locale: string): Promise<UserResponseDto> => {
  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  if (!profile.onboardingCompleted) {
    return redirect({ href: ROUTES.onboarding, locale });
  }

  return profile;
};
