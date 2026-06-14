import { zodResolver } from '@hookform/resolvers/zod';
import { useActionState, useCallback, useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { ActionState } from '@supertool/next-shared/src/types/action-state';
import { INITIAL_ACTION_STATE } from '@supertool/next-shared/src/types/action-state';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import type { CategoryFormValues } from '../../../constants/category-form-schema';

import { createCategory } from '../../../../../../actions/create-category';
import { updateCategory } from '../../../../../../actions/update-category';
import { ROUTES } from '../../../../../../constants/routes';
import { TRANSACTION_TYPE } from '../../../../../../constants/transaction';
import { categoryFormSchema } from '../../../constants/category-form-schema';
import { getDescendantIdSet } from '../../../utils/category-hierarchy';

interface UseCategoryFormParams {
  category: CategoryResponseDto | null;
  categoryList: CategoryResponseDto[];
}

const getDefaultValues = (category: CategoryResponseDto | null): CategoryFormValues =>
  category === null
    ? { name: '', type: TRANSACTION_TYPE.expense, parentId: '' }
    : { name: category.name, type: category.type, parentId: category.parentId ?? '' };

export const useCategoryForm = ({ category, categoryList }: UseCategoryFormParams) => {
  const router = useRouter();
  const isEditing = category !== null;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: getDefaultValues(category),
    mode: 'onBlur',
  });

  const selectedType = watch('type');

  const parentOptionList = useMemo(() => {
    const descendantIdSet = category ? getDescendantIdSet(categoryList, category.id) : new Set();

    return categoryList
      .filter(
        (candidate) =>
          candidate.type === selectedType &&
          candidate.id !== category?.id &&
          !descendantIdSet.has(candidate.id),
      )
      .map((candidate) => ({ value: candidate.id, label: candidate.name }));
  }, [categoryList, selectedType, category]);

  const [state, submitAction] = useActionState(
    async (_previousState: ActionState, values: CategoryFormValues): Promise<ActionState> =>
      isEditing ? updateCategory(category.id, values) : createCategory(values),
    INITIAL_ACTION_STATE,
  );

  const [isPending, startTransition] = useTransition();

  const handleFormSubmit = useCallback(
    (values: CategoryFormValues) => {
      startTransition(() => {
        submitAction(values);
      });
    },
    [submitAction, startTransition],
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.push(ROUTES.categories);
      router.refresh();
    }
  }, [state.status, router]);

  return {
    register,
    handleSubmit,
    control,
    errors,
    isEditing,
    isPending,
    state,
    parentOptionList,
    handleFormSubmit,
  };
};
