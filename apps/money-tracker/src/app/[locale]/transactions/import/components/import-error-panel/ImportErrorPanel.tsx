'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { TRANSACTION_IMPORT_MAX_FILE_SIZE_MEBIBYTES } from '@supertool/shared/constants/transaction-import';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import type { ImportActionError } from '../../types';

import styles from './ImportErrorPanel.module.scss';

const EMPTY_LIST_LENGTH = 0;

interface Props {
  error: ImportActionError;
}

export const ImportErrorPanel: FC<Props> = ({ error }) => {
  const translate = useTranslations(I18N_NAMESPACE.transactionsImportPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.transactionsImportPage}.errors`);

  const headline = translateError.has(error.code)
    ? translateError(error.code, { maxSizeMegabytes: TRANSACTION_IMPORT_MAX_FILE_SIZE_MEBIBYTES })
    : translateError(UNKNOWN_ERROR_CODE);

  return (
    <div className={styles.panel}>
      <Alert variant="destructive">
        <AlertDescription>{headline}</AlertDescription>
      </Alert>
      {error.rowErrorList !== undefined && error.rowErrorList.length > EMPTY_LIST_LENGTH && (
        <div className={styles.rowErrors}>
          <Typography variant="body-m" fontWeight="medium">
            {translate('rowErrorsTitle')}
          </Typography>
          <ul className={styles.rowErrorList}>
            {error.rowErrorList.map((rowError) => (
              <li key={rowError}>
                <Typography variant="body-s">{rowError}</Typography>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
