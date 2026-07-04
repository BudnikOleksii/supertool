'use client';

import type { FC } from 'react';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { SignUpForm } from '@supertool/widgets/src/components/sign-up-form/SignUpForm';

import { ROUTES } from '../../../constants/routes';

interface Props {
  submitLabel: string;
}

export const SignUpFormSection: FC<Props> = ({ submitLabel }) => {
  const router = useRouter();

  const handleSuccess = () => {
    router.replace(ROUTES.onboarding);
    router.refresh();
  };

  return <SignUpForm submitLabel={submitLabel} onSuccess={handleSuccess} />;
};
