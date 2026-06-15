import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link, redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

import { fetchCategoryList } from '../../../../actions/fetch-category-list';
import { fetchProfile } from '../../../../actions/fetch-profile';
import { ROUTES } from '../../../../constants/routes';
import { TransactionForm } from '../components/transaction-form/TransactionForm';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
}

const EMPTY_CATEGORY_COUNT = 0;

const NewTransactionPage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  const [translate, categoryList] = await Promise.all([
    getTranslations(I18N_NAMESPACE.transactionForm),
    fetchCategoryList(),
  ]);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>{translate('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryList.length === EMPTY_CATEGORY_COUNT ? (
            <div className={styles.emptyState}>
              <Typography variant="body-m">{translate('emptyCategoriesNote')}</Typography>
              <Button component={Link} href={ROUTES.categoriesNew}>
                {translate('emptyCategoriesLink')}
              </Button>
            </div>
          ) : (
            <TransactionForm
              categoryList={categoryList}
              defaultCurrency={profile.defaultCurrency ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NewTransactionPage;
