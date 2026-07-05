'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';
import type { UserResponseDto } from '@supertool/shared/generated/types.gen';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';
import { Combobox } from '@supertool/ui/src/components/molecules/combobox/Combobox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from '@supertool/ui/src/components/molecules/field/Field';

import { CURRENCY_OPTION_LIST } from '../../../../../constants/currency-option-list';
import { useProfileForm } from './hooks/use-profile-form';
import styles from './ProfileForm.module.scss';

interface Props {
  profile: UserResponseDto;
}

export const ProfileForm: FC<Props> = ({ profile }) => {
  const translate = useTranslations(I18N_NAMESPACE.settingsPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.settingsPage}.errors`);
  const { register, handleSubmit, control, errors, isPending, state, handleFormSubmit } =
    useProfileForm({ profile });

  const localeOptionList = LOCALE_CODE_LIST.map((code) => ({
    value: code,
    label: translate(`localeOption.${code}`),
  }));

  const submit = handleSubmit(handleFormSubmit);

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-first-name">
              <FieldTitle>{translate('firstNameLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="profile-first-name"
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
            <FieldLabel htmlFor="profile-last-name">
              <FieldTitle>{translate('lastNameLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="profile-last-name"
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
            <FieldLabel>
              <FieldTitle>{translate('localeLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="locale"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    optionList={localeOptionList}
                    ariaLabel={translate('localeLabel')}
                    error={Boolean(errors.locale)}
                  />
                )}
              />
            </FieldContent>
            <FieldDescription>{translate('localeDescription')}</FieldDescription>
            {errors.locale?.message && (
              <FieldError errors={[{ message: translateError(errors.locale.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel>
              <FieldTitle>{translate('defaultCurrencyLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="defaultCurrency"
                control={control}
                render={({ field }) => (
                  <Combobox
                    optionList={CURRENCY_OPTION_LIST}
                    value={field.value ?? ''}
                    onValueChange={(value) => {
                      if (value === '') {
                        return;
                      }

                      field.onChange(value);
                    }}
                    placeholder={translate('defaultCurrencyPlaceholder')}
                    searchLabel={translate('defaultCurrencySearchLabel')}
                    emptyMessage={translate('defaultCurrencyEmptyMessage')}
                    error={Boolean(errors.defaultCurrency)}
                  />
                )}
              />
            </FieldContent>
            <FieldDescription>{translate('defaultCurrencyDescription')}</FieldDescription>
            {errors.defaultCurrency?.message && (
              <FieldError errors={[{ message: translateError(errors.defaultCurrency.message) }]} />
            )}
          </Field>
        </FieldGroup>
      </FieldSet>

      {state.status === 'success' && (
        <Alert>
          <AlertDescription>{translate('updateSuccess')}</AlertDescription>
        </Alert>
      )}
      {state.status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            {translateError.has(state.code)
              ? translateError(state.code)
              : translateError(UNKNOWN_ERROR_CODE)}
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" className={styles.submit} disabled={isPending}>
        {translate('submit')}
      </Button>
    </form>
  );
};
