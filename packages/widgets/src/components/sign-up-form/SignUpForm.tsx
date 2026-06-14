'use client';

import type { FC } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
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

import type { SignUpFormValues } from '../../constants/auth-form-schema';

import { authClient } from '../../auth/auth-client';
import { getAuthErrorMessageKey } from '../../auth/get-auth-error-message-key';
import { signUpFormSchema } from '../../constants/auth-form-schema';
import styles from './SignUpForm.module.scss';

export interface SignUpFormProps {
  onSuccess: () => void;
  submitLabel: string;
}

export const SignUpForm: FC<SignUpFormProps> = ({ onSuccess, submitLabel }) => {
  const translate = useTranslations(I18N_NAMESPACE.authShared);
  const translateError = useTranslations(`${I18N_NAMESPACE.authShared}.errors`);
  const [isPending, startTransition] = useTransition();
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onBlur',
  });

  const submit = handleSubmit((values) => {
    setFormErrorKey(null);
    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });

      if (error) {
        setFormErrorKey(getAuthErrorMessageKey(error));
        return;
      }

      onSuccess();
    });
  });

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">
              <FieldTitle>{translate('name')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder={translate('namePlaceholder')}
                error={Boolean(errors.name)}
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
            </FieldContent>
            {errors.name?.message && (
              <FieldError errors={[{ message: translateError(errors.name.message) }]} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="email">
              <FieldTitle>{translate('email')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={translate('emailPlaceholder')}
                error={Boolean(errors.email)}
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </FieldContent>
            {errors.email?.message && (
              <FieldError errors={[{ message: translateError(errors.email.message) }]} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="password">
              <FieldTitle>{translate('password')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={translate('passwordPlaceholder')}
                error={Boolean(errors.password)}
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </FieldContent>
            {errors.password?.message && (
              <FieldError errors={[{ message: translateError(errors.password.message) }]} />
            )}
          </Field>
        </FieldGroup>
      </FieldSet>
      {formErrorKey && <FieldError errors={[{ message: translateError(formErrorKey) }]} />}
      <Button type="submit" className={styles.submit} disabled={isPending}>
        {submitLabel}
      </Button>
    </form>
  );
};
