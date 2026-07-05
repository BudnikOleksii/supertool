import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@supertool/ui/src/components/molecules/accordion/Accordion';

import styles from './FaqSection.module.scss';

const FAQ_TITLE_ID = 'faq-title';

const FAQ_KEY_LIST = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

export const FaqSection: FC = () => {
  const translate = useTranslations(`${I18N_NAMESPACE.homePage}.content.faq`);

  return (
    <section className={styles.section} aria-labelledby={FAQ_TITLE_ID}>
      <div className={styles.container}>
        <Typography
          id={FAQ_TITLE_ID}
          className={styles.title}
          variant="title-l"
          tag="h2"
          fontWeight="bold"
        >
          {translate('title')}
        </Typography>
        <Accordion className={styles.accordion} type="single" collapsible>
          {FAQ_KEY_LIST.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>{translate(`items.${key}.question`)}</AccordionTrigger>
              <AccordionContent>
                <Typography variant="body-m">{translate(`items.${key}.answer`)}</Typography>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
