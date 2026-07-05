import type { LucideIcon } from 'lucide-react';
import type { FC } from 'react';

import { ArrowLeftRight, Import, LineChart, Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

import styles from './AdvantagesSection.module.scss';

const ADVANTAGES_TITLE_ID = 'advantages-title';
const ICON_SIZE = 28;

const ADVANTAGE_KEY_LIST = ['tracking', 'import', 'insights', 'categories'] as const;

type AdvantageKey = (typeof ADVANTAGE_KEY_LIST)[number];

const ADVANTAGE_ICON_MAP: Record<AdvantageKey, LucideIcon> = {
  tracking: ArrowLeftRight,
  import: Import,
  insights: LineChart,
  categories: Tags,
};

export const AdvantagesSection: FC = () => {
  const translate = useTranslations(`${I18N_NAMESPACE.homePage}.content.advantages`);

  return (
    <section className={styles.section} id="features" aria-labelledby={ADVANTAGES_TITLE_ID}>
      <div className={styles.container}>
        <Typography
          id={ADVANTAGES_TITLE_ID}
          className={styles.title}
          variant="title-l"
          tag="h2"
          fontWeight="bold"
        >
          {translate('title')}
        </Typography>
        <div className={styles.grid}>
          {ADVANTAGE_KEY_LIST.map((key) => {
            const Icon = ADVANTAGE_ICON_MAP[key];

            return (
              <Card key={key} className={styles.card}>
                <CardHeader>
                  <span className={styles.icon}>
                    <Icon size={ICON_SIZE} aria-hidden />
                  </span>
                  <CardTitle variant="title-s" tag="h3">
                    {translate(`items.${key}.title`)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Typography className={styles.description} variant="body-m">
                    {translate(`items.${key}.description`)}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
