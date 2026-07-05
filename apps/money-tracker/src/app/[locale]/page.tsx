import type { Metadata } from 'next';
import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';

import { fetchProfile } from '../../actions/fetch-profile';
import { ROUTES } from '../../constants/routes';
import { LandingPage } from './components/landing/landing-page/LandingPage';

interface Props {
  params: Promise<{ locale: string }>;
}

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const { locale } = await props.params;

  const translate = await getTranslations({ locale, namespace: I18N_NAMESPACE.homePage });

  return {
    title: translate('metadata.title'),
    description: translate('metadata.description'),
  };
};

const HomePage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (profile !== null) {
    redirect({ href: ROUTES.dashboard, locale });
  }

  return <LandingPage />;
};

export default HomePage;
