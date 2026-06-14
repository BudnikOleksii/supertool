import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';

import { ROUTES } from '../../constants/routes';

interface Props {
  params: Promise<{ locale: string }>;
}

const HomePage: FC<Props> = (props) => {
  const { locale } = use(props.params);

  setRequestLocale(locale);

  const translate = useTranslations(I18N_NAMESPACE.homePage);

  return (
    <section>
      <h1>{translate('title')}</h1>
      <p>{translate('description')}</p>
      <Button component={Link} href={ROUTES.categories}>
        {translate('categoriesLink')}
      </Button>
      <Link href={ROUTES.transactions}>{translate('transactionsLink')}</Link>
    </section>
  );
};

export default HomePage;
