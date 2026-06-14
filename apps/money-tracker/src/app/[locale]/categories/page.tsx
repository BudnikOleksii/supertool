import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { Link, redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Skeleton } from '@supertool/ui/src/components/atoms/skeleton/Skeleton';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { fetchProfile } from '../../../actions/fetch-profile';
import { ROUTES } from '../../../constants/routes';
import { CategoryListServer } from './components/category-list-server/CategoryListServer';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
}

const SKELETON_ROW_COUNT = 5;
const SKELETON_ROW_HEIGHT = 56;
const skeletonRowList = Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => index);

const categoriesFallback = (
  <div className={styles.skeletonList}>
    {skeletonRowList.map((rowKey) => (
      <Skeleton key={rowKey} height={SKELETON_ROW_HEIGHT} />
    ))}
  </div>
);

const CategoriesPage: FC<Props> = async (props) => {
  const { locale } = await props.params;

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  const translate = await getTranslations(I18N_NAMESPACE.categoriesPage);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Typography variant="title-l" tag="h1">
            {translate('title')}
          </Typography>
          <Typography variant="body-m" className={styles.description}>
            {translate('description')}
          </Typography>
        </div>
        <Button component={Link} href={ROUTES.categoriesNew} size="sm">
          {translate('createButton')}
        </Button>
      </header>
      <Suspense fallback={categoriesFallback}>
        <CategoryListServer />
      </Suspense>
    </div>
  );
};

export default CategoriesPage;
