'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@supertool/ui/src/components/molecules/alert-dialog/AlertDialog';

import type { DialogMessage } from './hooks/use-bulk-delete';

interface Props {
  open: boolean;
  count: number;
  isPending: boolean;
  message: DialogMessage | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const BulkDeleteConfirmDialog: FC<Props> = ({
  open,
  count,
  isPending,
  message,
  onOpenChange,
  onConfirm,
}) => {
  const translate = useTranslations(`${I18N_NAMESPACE.transactionsPage}.bulkDelete`);
  const translateError = useTranslations(`${I18N_NAMESPACE.transactionsPage}.errors`);

  const resolveMessageText = (): string => {
    if (message === null) {
      return '';
    }

    if (message.kind === 'totalFailure') {
      return translate('totalFailure', { failed: message.failedCount });
    }

    return translateError.has(message.code)
      ? translateError(message.code)
      : translateError(UNKNOWN_ERROR_CODE);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{translate('confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{translate('confirmBody', { count })}</AlertDialogDescription>
        </AlertDialogHeader>

        {message !== null && (
          <Alert variant="destructive">
            <AlertDescription>{resolveMessageText()}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Button variant="outline" disabled={isPending}>
              {translate('cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            <Button variant="destructive" disabled={isPending}>
              {translate('confirm')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
