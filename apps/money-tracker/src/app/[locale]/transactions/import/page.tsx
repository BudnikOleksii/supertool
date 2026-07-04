import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

import { fetchProfile } from '../../../../actions/fetch-profile';
import { ROUTES } from '../../../../constants/routes';
import { ImportPageContent } from './components/import-page-content/ImportPageContent';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
}

const ImportTransactionsPage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  const translate = await getTranslations(I18N_NAMESPACE.transactionsImportPage);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>{translate('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportPageContent />
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportTransactionsPage;
