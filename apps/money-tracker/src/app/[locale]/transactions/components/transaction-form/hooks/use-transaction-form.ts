import type { DefaultValues } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from 'next-intl';
import { useActionState, useCallback, useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { INITIAL_ACTION_STATE } from '@supertool/next-shared/src/types/action-state';
import { checkIsCurrencyCode } from '@supertool/shared/constants/currency';
import type {
  CategoryResponseDto,
  TransactionResponseDto,
} from '@supertool/shared/generated/types.gen';

import type { TransactionFormValues } from '../../../constants/transaction-form-schema';

import { createTransaction } from '../../../../../../actions/create-transaction';
import { updateTransaction } from '../../../../../../actions/update-transaction';
import { TRANSACTION_TYPE } from '../../../../../../constants/transaction';
import { transactionFormSchema } from '../../../constants/transaction-form-schema';
import { getTodayDate } from '../../../utils/get-today-date';

interface UseTransactionFormParams {
  categoryList: CategoryResponseDto[];
  defaultCurrency: string | null;
  transaction?: TransactionResponseDto | undefined;
  copyFrom?: TransactionResponseDto | undefined;
}

const getDefaultValues = (
  defaultCurrency: string | null,
  prefill: TransactionResponseDto | undefined,
): DefaultValues<TransactionFormValues> => {
  if (prefill) {
    return {
      type: prefill.type,
      amount: prefill.amount,
      categoryId: prefill.categoryId,
      date: prefill.date,
      note: prefill.note,
      ...(checkIsCurrencyCode(prefill.currency) ? { currency: prefill.currency } : {}),
    };
  }

  return {
    type: TRANSACTION_TYPE.expense,
    amount: '',
    categoryId: '',
    date: getTodayDate(),
    note: '',
    ...(defaultCurrency && checkIsCurrencyCode(defaultCurrency)
      ? { currency: defaultCurrency }
      : {}),
  };
};

export const useTransactionForm = ({
  categoryList,
  defaultCurrency,
  transaction,
  copyFrom,
}: UseTransactionFormParams) => {
  const locale = useLocale();
  const isEditing = transaction !== undefined;

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getDefaultValues(defaultCurrency, transaction ?? copyFrom),
    mode: 'onBlur',
  });

  const selectedType = watch('type');

  const validCategoryIdSet = useMemo(
    () =>
      new Set(
        categoryList
          .filter((category) => category.type === selectedType)
          .map((category) => category.id),
      ),
    [categoryList, selectedType],
  );

  useEffect(() => {
    const selectedCategoryId = getValues('categoryId');

    if (selectedCategoryId !== '' && !validCategoryIdSet.has(selectedCategoryId)) {
      setValue('categoryId', '');
    }
  }, [validCategoryIdSet, getValues, setValue]);

  const [state, submitAction] = useActionState(
    async (_previousState: ActionState, values: TransactionFormValues): Promise<ActionState> =>
      isEditing
        ? updateTransaction(transaction.id, values, locale)
        : createTransaction(values, locale),
    INITIAL_ACTION_STATE,
  );

  const [isPending, startTransition] = useTransition();

  const handleFormSubmit = useCallback(
    (values: TransactionFormValues) => {
      startTransition(() => {
        submitAction(values);
      });
    },
    [submitAction, startTransition],
  );

  return {
    register,
    handleSubmit,
    control,
    errors,
    isEditing,
    isPending,
    state,
    selectedType,
    handleFormSubmit,
  };
};
