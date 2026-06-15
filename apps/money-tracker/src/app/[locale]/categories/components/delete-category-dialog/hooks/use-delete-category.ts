import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import type { CategoryResponseDto, DeleteCategoryDto } from '@supertool/shared/generated/types.gen';
import type { ComboboxOption } from '@supertool/ui/src/components/molecules/combobox/Combobox';

import { deleteCategory } from '../../../../../../actions/delete-category';
import { getDescendantIdSet } from '../../../utils/category-hierarchy';

export const TOP_LEVEL_VALUE = '__top_level__';

type DeleteMode = 'confirm' | 'reassign';

interface UseDeleteCategoryParams {
  category: CategoryResponseDto | null;
  categoryList: CategoryResponseDto[];
  topLevelLabel: string;
  onClose: () => void;
}

interface TargetOptionLists {
  transactionTargetOptionList: ComboboxOption[];
  childrenTargetOptionList: ComboboxOption[];
}

const toOption = (category: CategoryResponseDto): ComboboxOption => ({
  value: category.id,
  label: category.name,
});

const buildTransactionTargetOptionList = (
  category: CategoryResponseDto,
  categoryList: CategoryResponseDto[],
): ComboboxOption[] =>
  categoryList
    .filter((candidate) => candidate.type === category.type && candidate.id !== category.id)
    .map(toOption);

const buildChildrenTargetOptionList = (
  category: CategoryResponseDto,
  categoryList: CategoryResponseDto[],
  topLevelLabel: string,
): ComboboxOption[] => {
  const descendantIdSet = getDescendantIdSet(categoryList, category.id);
  const candidateList = categoryList.filter(
    (candidate) =>
      candidate.type === category.type &&
      candidate.id !== category.id &&
      !descendantIdSet.has(candidate.id),
  );

  return [{ value: TOP_LEVEL_VALUE, label: topLevelLabel }, ...candidateList.map(toOption)];
};

const buildTargetOptionLists = (
  category: CategoryResponseDto | null,
  categoryList: CategoryResponseDto[],
  topLevelLabel: string,
): TargetOptionLists => {
  if (category === null) {
    return { transactionTargetOptionList: [], childrenTargetOptionList: [] };
  }

  return {
    transactionTargetOptionList: buildTransactionTargetOptionList(category, categoryList),
    childrenTargetOptionList: buildChildrenTargetOptionList(category, categoryList, topLevelLabel),
  };
};

interface MissingTargetParams {
  hasChildren: boolean;
  transactionTargetId: string;
  childrenTargetId: string;
}

const getMissingTargetError = ({
  hasChildren,
  transactionTargetId,
  childrenTargetId,
}: MissingTargetParams): string | null => {
  if (hasChildren && childrenTargetId === '') {
    return 'reassignChildrenRequired';
  }

  if (!hasChildren && transactionTargetId === '') {
    return 'reassignTransactionsRequired';
  }

  return null;
};

const buildReassignment = (
  transactionTargetId: string,
  hasChildren: boolean,
  childrenTargetId: string,
): DeleteCategoryDto => {
  const reassignment: DeleteCategoryDto = {};

  if (transactionTargetId !== '') {
    reassignment.reassignTransactionsToCategoryId = transactionTargetId;
  }

  if (hasChildren) {
    reassignment.reassignChildrenToParentId =
      childrenTargetId === TOP_LEVEL_VALUE ? null : childrenTargetId;
  }

  return reassignment;
};

interface DeletePayload {
  error?: string;
  body?: DeleteCategoryDto;
}

interface DeletePayloadParams extends MissingTargetParams {
  mode: DeleteMode;
}

const getDeletePayload = ({
  mode,
  hasChildren,
  transactionTargetId,
  childrenTargetId,
}: DeletePayloadParams): DeletePayload => {
  if (mode === 'confirm') {
    return { body: {} };
  }

  const missingTargetError = getMissingTargetError({
    hasChildren,
    transactionTargetId,
    childrenTargetId,
  });

  if (missingTargetError !== null) {
    return { error: missingTargetError };
  }

  return { body: buildReassignment(transactionTargetId, hasChildren, childrenTargetId) };
};

export const useDeleteCategory = ({
  category,
  categoryList,
  topLevelLabel,
  onClose,
}: UseDeleteCategoryParams) => {
  const [mode, setMode] = useState<DeleteMode>('confirm');
  const [transactionTargetId, setTransactionTargetId] = useState('');
  const [childrenTargetId, setChildrenTargetId] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { hasChildren, transactionTargetOptionList, childrenTargetOptionList } = useMemo(() => {
    const lists = buildTargetOptionLists(category, categoryList, topLevelLabel);
    const childExists = categoryList.some((candidate) => candidate.parentId === category?.id);

    return { hasChildren: childExists, ...lists };
  }, [category, categoryList, topLevelLabel]);

  useEffect(() => {
    setMode('confirm');
    setTransactionTargetId('');
    setChildrenTargetId('');
    setErrorCode(null);
  }, [category?.id]);

  const runDelete = useCallback(
    (targetId: string, reassignment: DeleteCategoryDto) => {
      startTransition(async () => {
        const result = await deleteCategory(targetId, reassignment);

        if (result.status === 'success') {
          onClose();
          return;
        }

        setErrorCode(result.status === 'error' ? result.code : UNKNOWN_ERROR_CODE);

        if (result.status === 'error' && result.code === 'UNPROCESSABLE_ENTITY') {
          setMode('reassign');
        }
      });
    },
    [onClose],
  );

  const handleConfirm = useCallback(() => {
    if (category === null) {
      return;
    }

    if (mode === 'confirm' && hasChildren) {
      setMode('reassign');
      return;
    }

    const payload = getDeletePayload({ mode, hasChildren, transactionTargetId, childrenTargetId });

    if (payload.error !== undefined) {
      setErrorCode(payload.error);
      return;
    }

    runDelete(category.id, payload.body ?? {});
  }, [category, mode, hasChildren, transactionTargetId, childrenTargetId, runDelete]);

  return {
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
  };
};
