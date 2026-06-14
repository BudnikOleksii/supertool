import { zodResolver } from '@hookform/resolvers/zod';
import { useActionState, useCallback, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { INITIAL_ACTION_STATE } from '@supertool/next-shared/src/types/action-state';
import { checkIsCurrencyCode } from '@supertool/shared/constants/currency';
import { checkIsLocaleCode, DEFAULT_LOCALE } from '@supertool/shared/constants/locales';
import type { UserResponseDto } from '@supertool/shared/generated/types.gen';

import type { ProfileFormValues } from '../../../constants/profile-form-schema';

import { updateProfile } from '../../../../../../actions/update-profile';
import { profileFormSchema } from '../../../constants/profile-form-schema';

interface UseProfileFormParams {
  profile: UserResponseDto;
}

const getDefaultValues = (profile: UserResponseDto): ProfileFormValues => ({
  name: profile.name,
  locale: checkIsLocaleCode(profile.locale) ? profile.locale : DEFAULT_LOCALE,
  defaultCurrency:
    profile.defaultCurrency && checkIsCurrencyCode(profile.defaultCurrency)
      ? profile.defaultCurrency
      : undefined,
});

export const useProfileForm = ({ profile }: UseProfileFormParams) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getDefaultValues(profile),
    mode: 'onBlur',
  });

  const [isPending, startTransition] = useTransition();
  const [state, submitAction] = useActionState(
    async (_previousState: ActionState, values: ProfileFormValues): Promise<ActionState> =>
      updateProfile(values),
    INITIAL_ACTION_STATE,
  );

  const handleFormSubmit = useCallback(
    (values: ProfileFormValues) => {
      startTransition(() => {
        submitAction(values);
      });
    },
    [submitAction, startTransition],
  );

  return {
    register,
    handleSubmit,
    control,
    errors,
    isPending,
    state,
    handleFormSubmit,
  };
};
