import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

const HomePage = (props: HomePageProps) => {
  const { locale } = use(props.params);

  setRequestLocale(locale);

  const translate = useTranslations('home');

  return (
    <section>
      <h1>{translate('title')}</h1>
      <p>{translate('description')}</p>
    </section>
  );
};

export default HomePage;
