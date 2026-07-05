'use client';

import type { FC } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from '@supertool/ui/src/components/molecules/field/Field';

import type { ChangePasswordFormValues } from '../../constants/auth-form-schema';

import { authClient } from '../../auth/auth-client';
import { getAuthErrorMessageKey } from '../../auth/get-auth-error-message-key';
import { changePasswordFormSchema } from '../../constants/auth-form-schema';
import styles from './ChangePasswordForm.module.scss';

export const ChangePasswordForm: FC = () => {
  const translate = useTranslations(I18N_NAMESPACE.authShared);
  const translateError = useTranslations(`${I18N_NAMESPACE.authShared}.errors`);
  const [isPending, startTransition] = useTransition();
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const submit = handleSubmit((values) => {
    setFormErrorKey(null);
    setIsSuccess(false);
    startTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      if (error) {
        setFormErrorKey(getAuthErrorMessageKey(error));
        return;
      }

      setIsSuccess(true);
      reset();
    });
  });

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-password">
              <FieldTitle>{translate('currentPassword')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder={translate('currentPasswordPlaceholder')}
                error={Boolean(errors.currentPassword)}
                aria-invalid={Boolean(errors.currentPassword)}
                {...register('currentPassword')}
              />
            </FieldContent>
            {errors.currentPassword?.message && (
              <FieldError errors={[{ message: translateError(errors.currentPassword.message) }]} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">
              <FieldTitle>{translate('newPassword')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder={translate('newPasswordPlaceholder')}
                error={Boolean(errors.newPassword)}
                aria-invalid={Boolean(errors.newPassword)}
                {...register('newPassword')}
              />
            </FieldContent>
            {errors.newPassword?.message && (
              <FieldError errors={[{ message: translateError(errors.newPassword.message) }]} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">
              <FieldTitle>{translate('confirmPassword')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder={translate('confirmPasswordPlaceholder')}
                error={Boolean(errors.confirmPassword)}
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
              />
            </FieldContent>
            {errors.confirmPassword?.message && (
              <FieldError errors={[{ message: translateError(errors.confirmPassword.message) }]} />
            )}
          </Field>
        </FieldGroup>
      </FieldSet>
      {isSuccess && (
        <Alert>
          <AlertDescription>{translate('passwordChangeSuccess')}</AlertDescription>
        </Alert>
      )}
      {formErrorKey && <FieldError errors={[{ message: translateError(formErrorKey) }]} />}
      <Button type="submit" className={styles.submit} disabled={isPending}>
        {translate('changePasswordSubmit')}
      </Button>
    </form>
  );
};
