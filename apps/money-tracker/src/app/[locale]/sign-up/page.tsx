import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { NavigationLink } from '@supertool/next-shared/src/i18n/navigation/NavigationLink';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { UnderlineLink } from '@supertool/ui/src/components/atoms/underline-link/UnderlineLink';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

import { ROUTES } from '../../../constants/routes';
import styles from './page.module.scss';
import { SignUpFormSection } from './SignUpFormSection';

interface Props {
  params: Promise<{ locale: string }>;
}

const SignUpPage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const translate = await getTranslations(I18N_NAMESPACE.signUpPage);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>{translate('title')}</CardTitle>
          <CardDescription>{translate('description')}</CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          <SignUpFormSection submitLabel={translate('submit')} />
          <Typography>
            {translate('haveAccount')}{' '}
            <UnderlineLink component={NavigationLink} href={ROUTES.signIn}>
              {translate('signInLink')}
            </UnderlineLink>
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpPage;
