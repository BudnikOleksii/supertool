import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { Card, CardContent, CardHeader } from '@supertool/ui/src/components/molecules/card/Card';

import styles from './ReviewsSection.module.scss';

const REVIEWS_TITLE_ID = 'reviews-title';

const REVIEW_KEY_LIST = ['review1', 'review2', 'review3'] as const;

export const ReviewsSection: FC = () => {
  const translate = useTranslations(`${I18N_NAMESPACE.homePage}.content.reviews`);

  return (
    <section className={styles.section} aria-labelledby={REVIEWS_TITLE_ID}>
      <div className={styles.container}>
        <Typography
          id={REVIEWS_TITLE_ID}
          className={styles.title}
          variant="title-l"
          tag="h2"
          fontWeight="bold"
        >
          {translate('title')}
        </Typography>
        <div className={styles.grid}>
          {REVIEW_KEY_LIST.map((key) => (
            <Card key={key} className={styles.card}>
              <CardContent className={styles.quoteWrapper}>
                <Typography className={styles.quote} variant="body-m">
                  &ldquo;{translate(`items.${key}.quote`)}&rdquo;
                </Typography>
              </CardContent>
              <CardHeader>
                <Typography fontWeight="semibold" variant="body-m">
                  {translate(`items.${key}.name`)}
                </Typography>
                <Typography className={styles.role} variant="body-s">
                  {translate(`items.${key}.role`)}
                </Typography>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
