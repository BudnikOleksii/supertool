'use client';

import type { FC } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
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
  AlertDialogTrigger,
} from '@supertool/ui/src/components/molecules/alert-dialog/AlertDialog';

import { getTransactionEditPath } from '../../../../../constants/routes';
import { useDeleteTransaction } from './hooks/use-delete-transaction';
import styles from './TransactionRowActions.module.scss';

interface Props {
  id: string;
  period: string;
  page: number;
  formattedAmount: string;
  formattedDate: string;
}

export const TransactionRowActions: FC<Props> = ({
  id,
  period,
  page,
  formattedAmount,
  formattedDate,
}) => {
  const locale = useLocale();
  const translate = useTranslations(I18N_NAMESPACE.transactionsPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.transactionsPage}.errors`);
  const { open, handleOpenChange, errorCode, isPending, handleConfirm } = useDeleteTransaction({
    id,
    period,
    page,
    locale,
  });

  return (
    <div className={styles.actions}>
      <Button component={Link} href={getTransactionEditPath(id)} variant="ghost" size="sm">
        {translate('actions.edit')}
      </Button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm">
            {translate('actions.delete')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{translate('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {translate('delete.description', { amount: formattedAmount, date: formattedDate })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {errorCode !== null && (
            <Alert variant="destructive">
              <AlertDescription>
                {translateError.has(errorCode)
                  ? translateError(errorCode)
                  : translateError(UNKNOWN_ERROR_CODE)}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>
              <Button variant="outline" disabled={isPending}>
                {translate('delete.cancel')}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirm();
              }}
            >
              <Button variant="destructive" disabled={isPending}>
                {translate('delete.confirm')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
