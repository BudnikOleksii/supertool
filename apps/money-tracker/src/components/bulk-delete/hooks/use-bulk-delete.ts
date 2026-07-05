'use client';

import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useState, useTransition } from 'react';

import type { BulkDeleteActionResult } from '../../../actions/bulk-delete-transactions';
import type { BulkDeleteFailureItem, BulkDeleteView } from '../types';

import { bulkDeleteTransactions } from '../../../actions/bulk-delete-transactions';

const EMPTY_LIST_LENGTH = 0;
const NO_DELETIONS = 0;

export type DialogMessage =
  | { kind: 'error'; code: string }
  | { kind: 'totalFailure'; failedCount: number };

interface UseBulkDeleteParams {
  view: BulkDeleteView;
  selectedIdSet: ReadonlySet<string>;
  setSelectedIdSet: Dispatch<SetStateAction<Set<string>>>;
  onPartialFailure: (deletedCount: number, failedCount: number) => void;
  onBeforeOpen: () => void;
}

interface UseBulkDeleteResult {
  dialogIdList: string[] | null;
  isPending: boolean;
  dialogMessage: DialogMessage | null;
  handleOpen: () => void;
  handleClose: () => void;
  handleConfirm: () => void;
}

export const useBulkDelete = ({
  view,
  selectedIdSet,
  setSelectedIdSet,
  onPartialFailure,
  onBeforeOpen,
}: UseBulkDeleteParams): UseBulkDeleteResult => {
  const [dialogIdList, setDialogIdList] = useState<string[] | null>(null);
  const [dialogMessage, setDialogMessage] = useState<DialogMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = useCallback(() => {
    onBeforeOpen();
    setDialogMessage(null);
    setDialogIdList([...selectedIdSet]);
  }, [onBeforeOpen, selectedIdSet]);

  const handleClose = useCallback(() => {
    setDialogIdList(null);
    setDialogMessage(null);
  }, []);

  const applySuccessResult = useCallback(
    (deletedCount: number, failedList: BulkDeleteFailureItem[]) => {
      if (failedList.length === EMPTY_LIST_LENGTH) {
        setSelectedIdSet(new Set());
        setDialogIdList(null);
        return;
      }

      setSelectedIdSet(new Set(failedList.map((failure) => failure.id)));

      if (deletedCount === NO_DELETIONS) {
        setDialogMessage({ kind: 'totalFailure', failedCount: failedList.length });
        return;
      }

      onPartialFailure(deletedCount, failedList.length);
      setDialogIdList(null);
    },
    [onPartialFailure, setSelectedIdSet],
  );

  const handleResult = useCallback(
    (result: BulkDeleteActionResult) => {
      if (result.status === 'error') {
        setDialogMessage({ kind: 'error', code: result.code });
        return;
      }

      applySuccessResult(result.deletedCount, result.failedList);
    },
    [applySuccessResult],
  );

  const handleConfirm = useCallback(() => {
    if (!dialogIdList || dialogIdList.length === EMPTY_LIST_LENGTH) {
      return;
    }

    startTransition(async () => {
      const result = await bulkDeleteTransactions({ idList: dialogIdList, view });
      handleResult(result);
    });
  }, [dialogIdList, handleResult, view]);

  return {
    dialogIdList,
    isPending,
    dialogMessage,
    handleOpen,
    handleClose,
    handleConfirm,
  };
};
