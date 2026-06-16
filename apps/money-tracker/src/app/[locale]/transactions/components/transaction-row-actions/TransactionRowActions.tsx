'use client';

import type { FC } from 'react';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type {
  SortOrder,
  TransactionSortBy,
  TransactionType,
} from '@supertool/shared/generated/types.gen';
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

import { getTransactionCopyPath, getTransactionEditPath } from '../../../../../constants/routes';
import { useDeleteTransaction } from './hooks/use-delete-transaction';
import styles from './TransactionRowActions.module.scss';

const ICON_SIZE = 16;

interface Props {
  id: string;
  period: string;
  page: number;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
  formattedAmount: string;
  formattedDate: string;
}

export const TransactionRowActions: FC<Props> = ({
  id,
  period,
  page,
  type,
  categoryId,
  sortBy,
  sortOrder,
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
    view: { type, categoryId, sortBy, sortOrder },
  });

  return (
    <div className={styles.actions}>
      <Button
        component={Link}
        href={getTransactionCopyPath(id)}
        variant="ghost"
        size="icon"
        aria-label={translate('actions.copy')}
      >
        <Copy size={ICON_SIZE} />
      </Button>
      <Button
        component={Link}
        href={getTransactionEditPath(id)}
        variant="ghost"
        size="icon"
        aria-label={translate('actions.edit')}
      >
        <Pencil size={ICON_SIZE} />
      </Button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={translate('actions.delete')}>
            <Trash2 size={ICON_SIZE} />
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
