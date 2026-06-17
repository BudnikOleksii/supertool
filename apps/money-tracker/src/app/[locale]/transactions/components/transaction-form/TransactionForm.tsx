'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type {
  CategoryResponseDto,
  TransactionResponseDto,
} from '@supertool/shared/generated/types.gen';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import { Combobox } from '@supertool/ui/src/components/molecules/combobox/Combobox';
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from '@supertool/ui/src/components/molecules/field/Field';

import { ROUTES } from '../../../../../constants/routes';
import { TRANSACTION_TYPE_LIST } from '../../../../../constants/transaction';
import { CURRENCY_OPTION_LIST } from '../../constants/currency-option-list';
import { CategoryPicker } from '../category-picker/CategoryPicker';
import { useTransactionForm } from './hooks/use-transaction-form';
import styles from './TransactionForm.module.scss';

interface Props {
  categoryList: CategoryResponseDto[];
  defaultCurrency: string | null;
  transaction?: TransactionResponseDto;
  copyFrom?: TransactionResponseDto | undefined;
}

export const TransactionForm: FC<Props> = ({
  categoryList,
  defaultCurrency,
  transaction,
  copyFrom,
}) => {
  const translate = useTranslations(I18N_NAMESPACE.transactionForm);
  const translateError = useTranslations(`${I18N_NAMESPACE.transactionForm}.errors`);
  const {
    register,
    handleSubmit,
    control,
    errors,
    isEditing,
    isPending,
    state,
    selectedType,
    handleFormSubmit,
  } = useTransactionForm({ categoryList, defaultCurrency, transaction, copyFrom });

  const typeOptionList = TRANSACTION_TYPE_LIST.map((type) => ({
    value: type,
    label: translate(type === 'income' ? 'typeIncome' : 'typeExpense'),
  }));

  const submit = handleSubmit(handleFormSubmit);

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel>
              <FieldTitle>{translate('typeLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <div
                    className={styles.segmented}
                    role="group"
                    aria-label={translate('typeLabel')}
                  >
                    {typeOptionList.map((option) => (
                      <Button
                        key={option.value}
                        variant={field.value === option.value ? 'primary' : 'outline'}
                        aria-pressed={field.value === option.value}
                        className={styles.segment}
                        onClick={() => {
                          field.onChange(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                )}
              />
            </FieldContent>
            {errors.type?.message && (
              <FieldError errors={[{ message: translateError(errors.type.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-amount">
              <FieldTitle>{translate('amountLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="transaction-amount"
                inputMode="decimal"
                placeholder={translate('amountPlaceholder')}
                error={Boolean(errors.amount)}
                aria-invalid={Boolean(errors.amount)}
                {...register('amount')}
              />
            </FieldContent>
            {errors.amount?.message && (
              <FieldError errors={[{ message: translateError(errors.amount.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel>
              <FieldTitle>{translate('currencyLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Combobox
                    optionList={CURRENCY_OPTION_LIST}
                    value={field.value ?? ''}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    placeholder={translate('currencyPlaceholder')}
                    searchLabel={translate('currencySearchLabel')}
                    emptyMessage={translate('currencyEmptyMessage')}
                    error={Boolean(errors.currency)}
                  />
                )}
              />
            </FieldContent>
            {errors.currency?.message && (
              <FieldError errors={[{ message: translateError(errors.currency.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel>
              <FieldTitle>{translate('categoryLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <CategoryPicker
                    categoryList={categoryList}
                    transactionType={selectedType}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    placeholder={translate('categoryPlaceholder')}
                    ariaLabel={translate('categoryLabel')}
                    getParentOptionLabel={(parentName) => parentName}
                    error={Boolean(errors.categoryId)}
                  />
                )}
              />
            </FieldContent>
            {errors.categoryId?.message && (
              <FieldError errors={[{ message: translateError(errors.categoryId.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-date">
              <FieldTitle>{translate('dateLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="transaction-date"
                type="date"
                error={Boolean(errors.date)}
                aria-invalid={Boolean(errors.date)}
                {...register('date')}
              />
            </FieldContent>
            {errors.date?.message && (
              <FieldError errors={[{ message: translateError(errors.date.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-note">
              <FieldTitle>{translate('noteLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="transaction-note"
                placeholder={translate('notePlaceholder')}
                {...register('note')}
              />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>

      {state.status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            {translateError.has(state.code)
              ? translateError(state.code)
              : translateError(UNKNOWN_ERROR_CODE)}
          </AlertDescription>
        </Alert>
      )}

      <div className={styles.actions}>
        <Button component={Link} href={ROUTES.transactions} variant="outline">
          {translate('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isEditing ? translate('save') : translate('submit')}
        </Button>
      </div>
    </form>
  );
};
