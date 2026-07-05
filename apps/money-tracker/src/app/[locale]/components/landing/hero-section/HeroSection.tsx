import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { ROUTES } from '../../../../../constants/routes';
import styles from './HeroSection.module.scss';

const HERO_TITLE_ID = 'hero-title';
const FEATURES_ANCHOR = '#features';

export const HeroSection: FC = () => {
  const translate = useTranslations(`${I18N_NAMESPACE.homePage}.content.hero`);

  return (
    <section className={styles.hero} aria-labelledby={HERO_TITLE_ID}>
      <div className={styles.container}>
        <Typography
          id={HERO_TITLE_ID}
          className={styles.title}
          variant="title-xl"
          tag="h1"
          fontWeight="bold"
        >
          {translate('title')}
        </Typography>
        <Typography className={styles.subtitle} variant="body-l" tag="p">
          {translate('subtitle')}
        </Typography>
        <div className={styles.actions}>
          <Button component={Link} href={ROUTES.signUp} size="lg">
            {translate('getStarted')}
          </Button>
          <Button component={Link} href={ROUTES.signIn} variant="outline" size="lg">
            {translate('signIn')}
          </Button>
          <Button component="a" href={FEATURES_ANCHOR} variant="ghost" size="lg">
            {translate('learnMore')}
          </Button>
        </div>
      </div>
    </section>
  );
};
