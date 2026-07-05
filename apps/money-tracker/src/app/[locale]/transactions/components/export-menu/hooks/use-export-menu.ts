'use client';

import { useState, useTransition } from 'react';

import type { TransactionExportFormat } from '@supertool/shared/constants/transaction-export';

import type { ExportErrorKey } from '../../../../../../types/transaction-export';
import type { ExportFilterQuery } from '../types';

import { exportTransactions } from '../../../../../../actions/export-transactions';
import { downloadBlob } from '../download-blob';

interface UseExportMenuResult {
  isPending: boolean;
  errorCode: ExportErrorKey | null;
  runExport: (format: TransactionExportFormat) => void;
}

export const useExportMenu = (filters: ExportFilterQuery): UseExportMenuResult => {
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<ExportErrorKey | null>(null);

  const runExport = (format: TransactionExportFormat): void => {
    setErrorCode(null);

    startTransition(async () => {
      const result = await exportTransactions({ ...filters, format });

      if (result.status === 'error') {
        setErrorCode(result.code);

        return;
      }

      downloadBlob({
        content: result.content,
        fileName: result.fileName,
        mimeType: result.mimeType,
      });
    });
  };

  return { isPending, errorCode, runExport };
};
