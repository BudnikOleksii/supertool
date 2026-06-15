import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link, redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { fetchCategoryList } from '../../../../actions/fetch-category-list';
import { fetchProfile } from '../../../../actions/fetch-profile';
import { ROUTES } from '../../../../constants/routes';
import { CategoryForm } from '../components/category-form/CategoryForm';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
}

const NewCategoryPage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  const [translate, categoryList] = await Promise.all([
    getTranslations(I18N_NAMESPACE.categoriesPage),
    fetchCategoryList(),
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href={ROUTES.categories} className={styles.back}>
          {translate('form.backToCategories')}
        </Link>
        <Typography variant="title-l" tag="h1">
          {translate('form.createTitle')}
        </Typography>
      </div>
      <CategoryForm category={null} categoryList={categoryList} />
    </div>
  );
};

export default NewCategoryPage;
