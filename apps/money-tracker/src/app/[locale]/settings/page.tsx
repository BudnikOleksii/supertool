import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

import { resolveOnboardedProfile } from '../../../utils/resolve-onboarded-profile';
import { ProfileForm } from './components/profile-form/ProfileForm';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
}

const SettingsPage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const profile = await resolveOnboardedProfile(locale);

  const translate = await getTranslations(I18N_NAMESPACE.settingsPage);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>{translate('title')}</CardTitle>
          <CardDescription>{translate('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
