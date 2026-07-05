'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
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
import {
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@supertool/ui/src/components/molecules/field/Field';

import styles from './DeleteAccountSection.module.scss';
import { DELETE_ACCOUNT_FAILED_CODE, useDeleteAccount } from './hooks/use-delete-account';

interface Props {
  email: string;
}

export const DeleteAccountSection: FC<Props> = ({ email }) => {
  const translate = useTranslations(I18N_NAMESPACE.settingsPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.settingsPage}.errors`);
  const {
    isOpen,
    errorCode,
    isPending,
    isMatch,
    hasConfirmationValue,
    register,
    handleSubmit,
    errors,
    handleConfirm,
    handleOpenChange,
  } = useDeleteAccount({ email });

  const resolveErrorText = (): string =>
    translateError.has(errorCode ?? UNKNOWN_ERROR_CODE)
      ? translateError(errorCode ?? UNKNOWN_ERROR_CODE)
      : translateError(DELETE_ACCOUNT_FAILED_CODE);

  return (
    <div className={styles.section}>
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">{translate('deleteAccountButton')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{translate('deleteAccountTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{translate('deleteAccountDescription')}</AlertDialogDescription>
          </AlertDialogHeader>

          <form onSubmit={handleSubmit(handleConfirm)} className={styles.form} noValidate>
            <Field>
              <FieldLabel htmlFor="delete-account-confirmation">
                <FieldTitle>{translate('deleteAccountConfirmLabel', { email })}</FieldTitle>
              </FieldLabel>
              <Input
                id="delete-account-confirmation"
                autoComplete="off"
                placeholder={translate('deleteAccountConfirmPlaceholder')}
                error={hasConfirmationValue && !isMatch}
                aria-invalid={hasConfirmationValue && !isMatch}
                {...register('confirmation')}
              />
              {hasConfirmationValue && errors.confirmation?.message && (
                <FieldError errors={[{ message: translateError(errors.confirmation.message) }]} />
              )}
            </Field>

            {errorCode !== null && (
              <Alert variant="destructive">
                <AlertDescription>{resolveErrorText()}</AlertDescription>
              </Alert>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>
                <Button variant="outline" type="button" disabled={isPending}>
                  {translate('cancelButton')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleSubmit(handleConfirm)();
                }}
              >
                <Button variant="destructive" type="button" disabled={!isMatch || isPending}>
                  {translate('deleteAccountConfirmButton')}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
