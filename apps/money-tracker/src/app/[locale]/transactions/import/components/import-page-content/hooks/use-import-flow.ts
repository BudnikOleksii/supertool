import { useCallback, useState, useTransition } from 'react';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';

import type {
  ExecuteTransactionImportState,
  ImportActionError,
  PreviewTransactionImportState,
} from '../../../types';
import type { ImportFileCheckErrorKey } from '../../../utils/check-import-file';

import { executeTransactionImport } from '../../../../../../../actions/execute-transaction-import';
import { previewTransactionImport } from '../../../../../../../actions/preview-transaction-import';
import { checkImportFile } from '../../../utils/check-import-file';

const prepareImportFormData = (file: File): FormData => {
  const formData = new FormData();

  formData.append('file', file);

  return formData;
};

const prepareUnknownImportError = (): ImportActionError => ({
  status: 'error',
  code: UNKNOWN_ERROR_CODE,
});

export const useImportFlow = () => {
  const [file, setFile] = useState<File | null>(null);
  const [checkErrorKey, setCheckErrorKey] = useState<ImportFileCheckErrorKey | null>(null);
  const [previewState, setPreviewState] = useState<PreviewTransactionImportState | null>(null);
  const [executeState, setExecuteState] = useState<ExecuteTransactionImportState | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileSelect = useCallback((selectedFile: File) => {
    setPreviewState(null);
    setExecuteState(null);

    const checkResult = checkImportFile(selectedFile);

    if (!checkResult.ok) {
      setFile(null);
      setCheckErrorKey(checkResult.errorKey);

      return;
    }

    setCheckErrorKey(null);
    setFile(selectedFile);
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setCheckErrorKey(null);
    setPreviewState(null);
    setExecuteState(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (!file) {
      return;
    }

    startTransition(async () => {
      setPreviewState(
        await previewTransactionImport(prepareImportFormData(file)).catch(
          prepareUnknownImportError,
        ),
      );
    });
  }, [file]);

  const handleExecute = useCallback(() => {
    if (!file) {
      return;
    }

    startTransition(async () => {
      setExecuteState(
        await executeTransactionImport(prepareImportFormData(file)).catch(
          prepareUnknownImportError,
        ),
      );
    });
  }, [file]);

  return {
    file,
    checkErrorKey,
    preview: previewState?.status === 'success' ? previewState.preview : null,
    previewError: previewState?.status === 'error' ? previewState : null,
    report: executeState?.status === 'success' ? executeState.report : null,
    executeError: executeState?.status === 'error' ? executeState : null,
    isPending,
    handleFileSelect,
    handleClear,
    handlePreview,
    handleExecute,
  };
};
