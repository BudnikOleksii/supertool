'use client';

import type { FC } from 'react';

import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { TRANSACTION_EXPORT_FORMAT_LIST } from '@supertool/shared/constants/transaction-export';
import type { TransactionExportFormat } from '@supertool/shared/constants/transaction-export';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@supertool/ui/src/components/molecules/dropdown-menu/DropdownMenu';

import type { ExportErrorKey } from '../../../../../types/transaction-export';
import type { ExportMenuProps } from './types';

import styles from './ExportMenu.module.scss';
import { useExportMenu } from './hooks/use-export-menu';

const ICON_SIZE = 16;

export const ExportMenu: FC<ExportMenuProps> = ({ filters, namespace }) => {
  const translate = useTranslations(`${namespace}.export`);
  const translateError = useTranslations(`${namespace}.exportErrors`);
  const { isPending, errorCode, runExport } = useExportMenu(filters);

  const resolveErrorMessage = (code: ExportErrorKey): string =>
    translateError.has(code) ? translateError(code) : translateError(UNKNOWN_ERROR_CODE);

  const handleSelect = (format: TransactionExportFormat) => () => {
    runExport(format);
  };

  return (
    <div className={styles.container}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isPending}>
            {isPending ? (
              <Loader2 size={ICON_SIZE} className={styles.spinner} aria-hidden />
            ) : (
              <Download size={ICON_SIZE} aria-hidden />
            )}
            {isPending ? translate('loading') : translate('trigger')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {TRANSACTION_EXPORT_FORMAT_LIST.map((format) => (
            <DropdownMenuItem key={format} onSelect={handleSelect(format)}>
              <Typography variant="body-m">{translate(format)}</Typography>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {errorCode !== null && (
        <Alert variant="destructive" className={styles.error}>
          <AlertDescription>{resolveErrorMessage(errorCode)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
