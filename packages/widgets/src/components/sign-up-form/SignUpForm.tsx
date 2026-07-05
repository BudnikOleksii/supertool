'use client';

import type { FC } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { composeFullName } from '@supertool/shared/utils/full-name';
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
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
    mode: 'onBlur',
  });

  const submit = handleSubmit((values) => {
    setFormErrorKey(null);
    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        firstName: values.firstName,
        ...(values.lastName && { lastName: values.lastName }),
        name: composeFullName(values.firstName, values.lastName),
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
            <FieldLabel htmlFor="firstName">
              <FieldTitle>{translate('firstName')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="firstName"
                type="text"
                autoComplete="given-name"
                placeholder={translate('firstNamePlaceholder')}
                error={Boolean(errors.firstName)}
                aria-invalid={Boolean(errors.firstName)}
                {...register('firstName')}
              />
            </FieldContent>
            {errors.firstName?.message && (
              <FieldError errors={[{ message: translateError(errors.firstName.message) }]} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">
              <FieldTitle>{translate('lastName')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="lastName"
                type="text"
                autoComplete="family-name"
                placeholder={translate('lastNamePlaceholder')}
                error={Boolean(errors.lastName)}
                aria-invalid={Boolean(errors.lastName)}
                {...register('lastName')}
              />
            </FieldContent>
            {errors.lastName?.message && (
              <FieldError errors={[{ message: translateError(errors.lastName.message) }]} />
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
