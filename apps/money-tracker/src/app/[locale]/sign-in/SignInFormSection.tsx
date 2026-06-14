'use client';

import type { FC } from 'react';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { SignInForm } from '@supertool/widgets/src/components/sign-in-form/SignInForm';

import { ROUTES } from '../../../constants/routes';

interface Props {
  submitLabel: string;
}

export const SignInFormSection: FC<Props> = ({ submitLabel }) => {
  const router = useRouter();

  const handleSuccess = () => {
    router.replace(ROUTES.home);
    router.refresh();
  };

  return <SignInForm submitLabel={submitLabel} onSuccess={handleSuccess} />;
};
