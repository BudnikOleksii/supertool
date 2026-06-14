'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';
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
import styles from './CategoryForm.module.scss';
import { useCategoryForm } from './hooks/use-category-form';

interface Props {
  category: CategoryResponseDto | null;
  categoryList: CategoryResponseDto[];
}

export const CategoryForm: FC<Props> = ({ category, categoryList }) => {
  const translate = useTranslations(I18N_NAMESPACE.categoriesPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.categoriesPage}.errors`);
  const {
    register,
    handleSubmit,
    control,
    errors,
    isEditing,
    isPending,
    state,
    parentOptionList,
    handleFormSubmit,
  } = useCategoryForm({ category, categoryList });

  const typeOptionList = TRANSACTION_TYPE_LIST.map((type) => ({
    value: type,
    label: translate(type === 'income' ? 'incomeType' : 'expenseType'),
  }));

  const submit = handleSubmit(handleFormSubmit);

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="category-name">
              <FieldTitle>{translate('form.nameLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="category-name"
                placeholder={translate('form.namePlaceholder')}
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
            <FieldLabel>
              <FieldTitle>{translate('form.typeLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    optionList={typeOptionList}
                    ariaLabel={translate('form.typeLabel')}
                    disabled={isEditing}
                    error={Boolean(errors.type)}
                  />
                )}
              />
            </FieldContent>
            {errors.type?.message && (
              <FieldError errors={[{ message: translateError(errors.type.message) }]} />
            )}
          </Field>

          <Field>
            <FieldLabel>
              <FieldTitle>{translate('form.parentLabel')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <Combobox
                    optionList={parentOptionList}
                    value={field.value ?? ''}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    placeholder={translate('form.parentPlaceholder')}
                    searchLabel={translate('form.parentSearchLabel')}
                    emptyMessage={translate('form.parentEmptyMessage')}
                  />
                )}
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
        <Button component={Link} href={ROUTES.categories} variant="outline">
          {translate('form.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isEditing ? translate('form.submitSave') : translate('form.submitCreate')}
        </Button>
      </div>
    </form>
  );
};
