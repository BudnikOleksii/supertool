'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';
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
} from '@supertool/ui/src/components/molecules/alert-dialog/AlertDialog';
import { Combobox } from '@supertool/ui/src/components/molecules/combobox/Combobox';
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from '@supertool/ui/src/components/molecules/field/Field';

import styles from './DeleteCategoryDialog.module.scss';
import { useDeleteCategory } from './hooks/use-delete-category';

interface Props {
  category: CategoryResponseDto | null;
  categoryList: CategoryResponseDto[];
  onClose: () => void;
}

export const DeleteCategoryDialog: FC<Props> = ({ category, categoryList, onClose }) => {
  const translate = useTranslations(I18N_NAMESPACE.categoriesPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.categoriesPage}.errors`);
  const {
    mode,
    hasChildren,
    transactionTargetId,
    setTransactionTargetId,
    childrenTargetId,
    setChildrenTargetId,
    transactionTargetOptionList,
    childrenTargetOptionList,
    errorCode,
    isPending,
    handleConfirm,
  } = useDeleteCategory({
    category,
    categoryList,
    topLevelLabel: translate('delete.reassignChildrenTopLevel'),
    onClose,
  });

  const categoryName = category?.name ?? '';
  const isReassign = mode === 'reassign';

  return (
    <AlertDialog
      open={category !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{translate('delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {isReassign
              ? translate('delete.reassignDescription', { name: categoryName })
              : translate('delete.description', { name: categoryName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isReassign && (
          <div className={styles.fieldList}>
            <Field>
              <FieldLabel>
                <FieldTitle>{translate('delete.reassignTransactionsLabel')}</FieldTitle>
              </FieldLabel>
              <FieldContent>
                <Combobox
                  optionList={transactionTargetOptionList}
                  value={transactionTargetId}
                  onValueChange={setTransactionTargetId}
                  placeholder={translate('delete.reassignTransactionsPlaceholder')}
                  searchLabel={translate('form.parentSearchLabel')}
                  emptyMessage={translate('form.parentEmptyMessage')}
                />
              </FieldContent>
            </Field>

            {hasChildren && (
              <Field>
                <FieldLabel>
                  <FieldTitle>{translate('delete.reassignChildrenLabel')}</FieldTitle>
                </FieldLabel>
                <FieldContent>
                  <Combobox
                    optionList={childrenTargetOptionList}
                    value={childrenTargetId}
                    onValueChange={setChildrenTargetId}
                    placeholder={translate('delete.reassignTransactionsPlaceholder')}
                    searchLabel={translate('form.parentSearchLabel')}
                    emptyMessage={translate('form.parentEmptyMessage')}
                  />
                </FieldContent>
              </Field>
            )}
          </div>
        )}

        {errorCode !== null && (
          <Alert variant="destructive">
            <AlertDescription>
              {translateError.has(errorCode)
                ? translateError(errorCode)
                : translateError('UNKNOWN')}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Button variant="outline">{translate('delete.cancel')}</Button>
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
  );
};
