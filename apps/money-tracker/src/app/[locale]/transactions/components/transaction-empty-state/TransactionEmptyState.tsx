import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import styles from './TransactionEmptyState.module.scss';

export const TransactionEmptyState: FC = async () => {
  const translate = await getTranslations(I18N_NAMESPACE.transactionsPage);

  return (
    <div className={styles.container}>
      <Typography variant="title-s">{translate('empty.title')}</Typography>
      <Typography variant="body-m" className={styles.description}>
        {translate('empty.description')}
      </Typography>
    </div>
  );
};
