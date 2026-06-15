import { useCallback, useState, useTransition } from 'react';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';

import type { TransactionViewParams } from '../../../utils/build-transactions-redirect-query';

import { deleteTransaction } from '../../../../../../actions/delete-transaction';

interface UseDeleteTransactionParams {
  id: string;
  period: string;
  page: number;
  locale: string;
  view: TransactionViewParams;
}

export const useDeleteTransaction = ({
  id,
  period,
  page,
  locale,
  view,
}: UseDeleteTransactionParams) => {
  const [open, setOpen] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);

    if (next) {
      setErrorCode(null);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    startTransition(async () => {
      const result = await deleteTransaction({ id, period, page, locale, view });

      if (result.status === 'success') {
        setOpen(false);
        return;
      }

      setErrorCode(result.status === 'error' ? result.code : UNKNOWN_ERROR_CODE);
    });
  }, [id, period, page, locale, view]);

  return { open, handleOpenChange, errorCode, isPending, handleConfirm };
};
