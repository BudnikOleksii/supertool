'use client';

import type { FC, ReactNode } from 'react';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { MAX_BULK_DELETE_IDS } from '@supertool/shared/constants/transaction-bulk';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';

import type { BulkDeleteView } from './types';

import { BulkDeleteActionBar } from './BulkDeleteActionBar';
import { BulkDeleteConfirmDialog } from './BulkDeleteConfirmDialog';
import { BulkDeleteContext } from './BulkDeleteContext';
import { useBarMessage } from './hooks/use-bar-message';
import { useBulkDelete } from './hooks/use-bulk-delete';
import { useTransactionSelection } from './hooks/use-transaction-selection';

const EMPTY_SELECTION = 0;

interface Props {
  visibleIdList: string[];
  view: BulkDeleteView;
  children: ReactNode;
}

export const BulkDeleteProvider: FC<Props> = ({ visibleIdList, view, children }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.transactionsPage}.bulkDelete`);
  const { barMessage, notifyOverCap, notifyPartialFailure, clearBarMessage } = useBarMessage();

  const selection = useTransactionSelection({ visibleIdList, onOverCap: notifyOverCap });

  const { dialogIdList, isPending, dialogMessage, handleOpen, handleClose, handleConfirm } =
    useBulkDelete({
      view,
      selectedIdSet: selection.selectedIdSet,
      setSelectedIdSet: selection.setSelectedIdSet,
      onPartialFailure: notifyPartialFailure,
      onBeforeOpen: clearBarMessage,
    });

  const handleClear = useCallback(() => {
    clearBarMessage();
    selection.handleClearSelection();
  }, [clearBarMessage, selection]);

  const contextValue = useMemo(
    () => ({
      selectedIdSet: selection.selectedIdSet,
      isSubmitting: isPending,
      onToggleSelection: selection.handleToggleSelection,
    }),
    [selection.selectedIdSet, isPending, selection.handleToggleSelection],
  );

  const selectAllLabel = selection.areAllVisibleSelected
    ? translate('deselectAllVisible')
    : translate('selectAllVisible');

  return (
    <BulkDeleteContext.Provider value={contextValue}>
      {children}

      {barMessage !== null && (
        <Alert variant="default">
          <AlertDescription>
            {barMessage.kind === 'partial'
              ? translate('partial', {
                  deleted: barMessage.deletedCount,
                  failed: barMessage.failedCount,
                })
              : translate('overCap', { cap: MAX_BULK_DELETE_IDS })}
          </AlertDescription>
        </Alert>
      )}

      {selection.selectedCount > EMPTY_SELECTION && (
        <BulkDeleteActionBar
          selectedCountLabel={translate('selectedCount', { count: selection.selectedCount })}
          selectAllLabel={selectAllLabel}
          clearLabel={translate('clearSelection')}
          deleteLabel={translate('deleteSelected')}
          areAllVisibleSelected={selection.areAllVisibleSelected}
          isSubmitting={isPending}
          onSelectAllVisible={selection.handleSelectAllVisible}
          onClear={handleClear}
          onDelete={handleOpen}
        />
      )}

      <BulkDeleteConfirmDialog
        open={dialogIdList !== null}
        count={dialogIdList?.length ?? EMPTY_SELECTION}
        isPending={isPending}
        message={dialogMessage}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
        onConfirm={handleConfirm}
      />
    </BulkDeleteContext.Provider>
  );
};
