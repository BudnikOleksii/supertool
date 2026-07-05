'use client';

import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useMemo, useState } from 'react';

import { MAX_BULK_DELETE_IDS } from '@supertool/shared/constants/transaction-bulk';

const EMPTY_LIST_LENGTH = 0;

const checkAreAllVisibleSelected = (
  visibleIdList: string[],
  selectedIdSet: ReadonlySet<string>,
): boolean =>
  visibleIdList.length > EMPTY_LIST_LENGTH && visibleIdList.every((id) => selectedIdSet.has(id));

const getSetWithoutList = (source: ReadonlySet<string>, idList: string[]): Set<string> => {
  const next = new Set(source);
  for (const id of idList) {
    next.delete(id);
  }
  return next;
};

const getSetWithListUnderCap = (
  source: ReadonlySet<string>,
  idList: string[],
  onOverCap: () => void,
): Set<string> => {
  const next = new Set(source);
  for (const id of idList) {
    if (next.size >= MAX_BULK_DELETE_IDS) {
      onOverCap();
      break;
    }
    next.add(id);
  }
  return next;
};

interface UseTransactionSelectionParams {
  visibleIdList: string[];
  onOverCap: () => void;
}

interface UseTransactionSelectionResult {
  selectedIdSet: Set<string>;
  setSelectedIdSet: Dispatch<SetStateAction<Set<string>>>;
  selectedCount: number;
  areAllVisibleSelected: boolean;
  handleToggleSelection: (id: string) => void;
  handleClearSelection: () => void;
  handleSelectAllVisible: () => void;
}

export const useTransactionSelection = ({
  visibleIdList,
  onOverCap,
}: UseTransactionSelectionParams): UseTransactionSelectionResult => {
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set());

  const areAllVisibleSelected = useMemo(
    () => checkAreAllVisibleSelected(visibleIdList, selectedIdSet),
    [selectedIdSet, visibleIdList],
  );

  const handleToggleSelection = useCallback(
    (id: string) => {
      setSelectedIdSet((previous) => {
        if (previous.has(id)) {
          return getSetWithoutList(previous, [id]);
        }
        if (previous.size >= MAX_BULK_DELETE_IDS) {
          onOverCap();
          return previous;
        }
        const next = new Set(previous);
        next.add(id);
        return next;
      });
    },
    [onOverCap],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIdSet(new Set());
  }, []);

  const handleSelectAllVisible = useCallback(() => {
    setSelectedIdSet((previous) => {
      if (visibleIdList.length === EMPTY_LIST_LENGTH) {
        return previous;
      }
      if (checkAreAllVisibleSelected(visibleIdList, previous)) {
        return getSetWithoutList(previous, visibleIdList);
      }
      return getSetWithListUnderCap(previous, visibleIdList, onOverCap);
    });
  }, [onOverCap, visibleIdList]);

  return {
    selectedIdSet,
    setSelectedIdSet,
    selectedCount: selectedIdSet.size,
    areAllVisibleSelected,
    handleToggleSelection,
    handleClearSelection,
    handleSelectAllVisible,
  };
};
