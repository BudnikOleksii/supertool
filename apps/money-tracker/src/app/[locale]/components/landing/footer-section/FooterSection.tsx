import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { ROUTES } from '../../../../../constants/routes';
import styles from './FooterSection.module.scss';

const CTA_TITLE_ID = 'cta-title';

export const FooterSection: FC = () => {
  const translateCta = useTranslations(`${I18N_NAMESPACE.homePage}.content.cta`);
  const translateFooter = useTranslations(`${I18N_NAMESPACE.homePage}.content.footer`);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <section className={styles.cta} aria-labelledby={CTA_TITLE_ID}>
        <div className={styles.ctaContainer}>
          <Typography
            id={CTA_TITLE_ID}
            className={styles.ctaTitle}
            variant="title-l"
            tag="h2"
            fontWeight="bold"
          >
            {translateCta('title')}
          </Typography>
          <Typography className={styles.ctaSubtitle} variant="body-l" tag="p">
            {translateCta('subtitle')}
          </Typography>
          <div className={styles.ctaActions}>
            <Button component={Link} href={ROUTES.signUp} size="lg">
              {translateCta('getStarted')}
            </Button>
            <Button component={Link} href={ROUTES.signIn} variant="outline" size="lg">
              {translateCta('signIn')}
            </Button>
          </div>
        </div>
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <Typography className={styles.tagline} variant="body-m">
            {translateFooter('tagline')}
          </Typography>
          <div className={styles.links}>
            <Link className={styles.link} href={ROUTES.signIn}>
              <Typography variant="body-s">{translateFooter('signIn')}</Typography>
            </Link>
            <Link className={styles.link} href={ROUTES.signUp}>
              <Typography variant="body-s">{translateFooter('signUp')}</Typography>
            </Link>
          </div>
          <Typography className={styles.copyright} variant="body-s">
            {translateFooter('copyright', { year: currentYear })}
          </Typography>
        </div>
      </footer>
    </>
  );
};
