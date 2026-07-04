'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { NearDuplicateClusterDto } from '@supertool/shared/generated/types.gen';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@supertool/ui/src/components/atoms/alert/Alert';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import styles from './NearDuplicateAlert.module.scss';

const EMPTY_LIST_LENGTH = 0;

interface Props {
  clusterList: NearDuplicateClusterDto[];
}

export const NearDuplicateAlert: FC<Props> = ({ clusterList }) => {
  const translate = useTranslations(I18N_NAMESPACE.transactionsImportPage);

  if (clusterList.length === EMPTY_LIST_LENGTH) {
    return null;
  }

  return (
    <Alert>
      <AlertTitle>{translate('nearDuplicateWarningTitle')}</AlertTitle>
      <AlertDescription>{translate('nearDuplicateWarningDescription')}</AlertDescription>
      <ul className={styles.clusterList}>
        {clusterList.map((cluster) => (
          <li key={cluster.normalizedKey}>
            <Typography variant="body-s">{cluster.rawNameList.join(', ')}</Typography>
          </li>
        ))}
      </ul>
    </Alert>
  );
};
