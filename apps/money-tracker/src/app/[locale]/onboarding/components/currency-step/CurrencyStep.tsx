'use client';

import type { FC } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { checkIsCurrencyCode } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Combobox } from '@supertool/ui/src/components/molecules/combobox/Combobox';
import { Field, FieldError, FieldLabel } from '@supertool/ui/src/components/molecules/field/Field';

import type { CurrencyStepValues } from './currency-step-schema';

import { updateDefaultCurrency } from '../../../../../actions/update-default-currency';
import { CURRENCY_OPTION_LIST } from '../../../../../constants/currency-option-list';
import { ROUTES } from '../../../../../constants/routes';
import { ONBOARDING_STEP, ONBOARDING_STEP_SEARCH_PARAM } from '../../constants';
import { currencyStepSchema } from './currency-step-schema';
import styles from './CurrencyStep.module.scss';

interface Props {
  defaultCurrency?: string | undefined;
}

const CATEGORIES_STEP_HREF = `${ROUTES.onboarding}?${ONBOARDING_STEP_SEARCH_PARAM}=${ONBOARDING_STEP.categories}`;

const buildUnknownState = (): ActionState => ({ status: 'error', code: UNKNOWN_ERROR_CODE });

export const CurrencyStep: FC<Props> = ({ defaultCurrency }) => {
  const translate = useTranslations(I18N_NAMESPACE.onboardingPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.onboardingPage}.errors`);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({ status: 'idle' });

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CurrencyStepValues>({
    resolver: zodResolver(currencyStepSchema),
    defaultValues: {
      ...(defaultCurrency !== undefined &&
        checkIsCurrencyCode(defaultCurrency) && { defaultCurrency }),
    },
  });

  const handleFormSubmit = (values: CurrencyStepValues) => {
    startTransition(async () => {
      const result = await updateDefaultCurrency(values.defaultCurrency).catch(buildUnknownState);

      if (result.status === 'error') {
        setState(result);

        return;
      }

      router.replace(CATEGORIES_STEP_HREF);
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form} noValidate>
      <Field>
        <FieldLabel>{translate('currencyLabel')}</FieldLabel>
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
              placeholder={translate('currencyPlaceholder')}
              searchLabel={translate('currencySearchLabel')}
              emptyMessage={translate('currencyEmptyMessage')}
              error={Boolean(errors.defaultCurrency)}
            />
          )}
        />
        {errors.defaultCurrency?.message && (
          <FieldError errors={[{ message: translateError(errors.defaultCurrency.message) }]} />
        )}
      </Field>

      {state.status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            {translateError.has(state.code)
              ? translateError(state.code)
              : translateError(UNKNOWN_ERROR_CODE)}
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        {translate('continueButton')}
      </Button>
    </form>
  );
};
