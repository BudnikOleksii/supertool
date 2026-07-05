import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { ROUTES } from '../../../../../constants/routes';
import { PERIOD_SEARCH_PARAM } from '../../../../../constants/search-params';
import styles from './TransactionEmptyState.module.scss';

type EmptyStateVariant = 'emptyMonth' | 'noMatches' | 'noSearchMatches';

interface Props {
  variant: EmptyStateVariant;
  period: string;
  clearQuery?: Record<string, string> | undefined;
}

const COPY_KEY_BY_VARIANT: Record<EmptyStateVariant, string> = {
  emptyMonth: 'empty',
  noMatches: 'noMatches',
  noSearchMatches: 'noSearchMatches',
};

export const TransactionEmptyState: FC<Props> = async ({ variant, period, clearQuery }) => {
  const translate = await getTranslations(I18N_NAMESPACE.transactionsPage);
  const copyKey = COPY_KEY_BY_VARIANT[variant];
  const hasClearAction = variant === 'noMatches' || variant === 'noSearchMatches';

  return (
    <div className={styles.container}>
      <Typography variant="title-s">{translate(`${copyKey}.title`)}</Typography>
      <Typography variant="body-m" className={styles.description}>
        {translate(`${copyKey}.description`)}
      </Typography>
      {hasClearAction && (
        <Button
          component={Link}
          href={{
            pathname: ROUTES.transactions,
            query: clearQuery ?? { [PERIOD_SEARCH_PARAM]: period },
          }}
          variant="outline"
        >
          {translate(`${copyKey}.clear`)}
        </Button>
      )}
    </div>
  );
};
