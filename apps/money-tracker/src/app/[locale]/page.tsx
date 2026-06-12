import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

interface Props {
  params: Promise<{ locale: string }>;
}

const HomePage: FC<Props> = (props) => {
  const { locale } = use(props.params);

  setRequestLocale(locale);

  const translate = useTranslations('homePage');

  return (
    <section>
      <h1>{translate('title')}</h1>
      <p>{translate('description')}</p>
    </section>
  );
};

export default HomePage;
