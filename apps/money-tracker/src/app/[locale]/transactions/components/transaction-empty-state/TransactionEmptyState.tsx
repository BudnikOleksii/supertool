import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { ROUTES } from '../../../../../constants/routes';
import { PERIOD_SEARCH_PARAM } from '../../constants';
import styles from './TransactionEmptyState.module.scss';

interface Props {
  variant: 'emptyMonth' | 'noMatches';
  period: string;
}

export const TransactionEmptyState: FC<Props> = async ({ variant, period }) => {
  const translate = await getTranslations(I18N_NAMESPACE.transactionsPage);
  const isNoMatches = variant === 'noMatches';
  const copyKey = isNoMatches ? 'noMatches' : 'empty';

  return (
    <div className={styles.container}>
      <Typography variant="title-s">{translate(`${copyKey}.title`)}</Typography>
      <Typography variant="body-m" className={styles.description}>
        {translate(`${copyKey}.description`)}
      </Typography>
      {isNoMatches && (
        <Button
          component={Link}
          href={{ pathname: ROUTES.transactions, query: { [PERIOD_SEARCH_PARAM]: period } }}
          variant="outline"
        >
          {translate('noMatches.clear')}
        </Button>
      )}
    </div>
  );
};
