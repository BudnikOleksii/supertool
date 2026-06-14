'use client';

import type { FC } from 'react';

import { checkIsLocaleCode, DEFAULT_LOCALE } from '@supertool/shared/constants/locales';
import { SignInForm } from '@supertool/widgets/src/components/sign-in-form/SignInForm';

import { fetchSignedInLocale } from '../../../actions/fetch-profile-locale';
import { ROUTES } from '../../../constants/routes';

interface Props {
  submitLabel: string;
}

const handleSignInSuccess = async (): Promise<void> => {
  try {
    const locale = await fetchSignedInLocale();
    const targetLocale = locale !== null && checkIsLocaleCode(locale) ? locale : DEFAULT_LOCALE;
    const target = targetLocale === DEFAULT_LOCALE ? ROUTES.home : `/${targetLocale}`;

    globalThis.location.assign(target);
  } catch {
    globalThis.location.assign(ROUTES.home);
  }
};

export const SignInFormSection: FC<Props> = ({ submitLabel }) => (
  <SignInForm submitLabel={submitLabel} onSuccess={handleSignInSuccess} />
);
