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

import { fetchCategoryList } from '../../../../../actions/fetch-category-list';
import { fetchTransaction } from '../../../../../actions/fetch-transaction';
import { ROUTES } from '../../../../../constants/routes';
import { resolveOnboardedProfile } from '../../../../../utils/resolve-onboarded-profile';
import { TransactionForm } from '../../components/transaction-form/TransactionForm';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

const EditTransactionPage: FC<Props> = async (props) => {
  const { locale, id } = await props.params;

  setRequestLocale(locale);

  const profile = await resolveOnboardedProfile(locale);

  const [translate, categoryList, transaction] = await Promise.all([
    getTranslations(I18N_NAMESPACE.transactionForm),
    fetchCategoryList(),
    fetchTransaction(id),
  ]);

  if (!transaction) {
    return redirect({ href: ROUTES.transactions, locale });
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>{translate('editTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            categoryList={categoryList}
            defaultCurrency={profile.defaultCurrency ?? null}
            transaction={transaction}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default EditTransactionPage;
