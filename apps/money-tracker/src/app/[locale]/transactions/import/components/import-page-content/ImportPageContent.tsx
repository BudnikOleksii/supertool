'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';

import { ImportDropzone } from '../import-dropzone/ImportDropzone';
import { ImportErrorPanel } from '../import-error-panel/ImportErrorPanel';
import { ImportPreviewPanel } from '../import-preview-panel/ImportPreviewPanel';
import { ImportResultPanel } from '../import-result-panel/ImportResultPanel';
import { useImportFlow } from './hooks/use-import-flow';
import styles from './ImportPageContent.module.scss';

export const ImportPageContent: FC = () => {
  const translate = useTranslations(I18N_NAMESPACE.transactionsImportPage);
  const {
    file,
    checkErrorKey,
    preview,
    previewError,
    report,
    executeError,
    isPending,
    handleFileSelect,
    handleClear,
    handlePreview,
    handleExecute,
  } = useImportFlow();

  if (report) {
    return <ImportResultPanel report={report} />;
  }

  return (
    <div className={styles.content}>
      <ImportDropzone
        file={file}
        checkErrorKey={checkErrorKey}
        disabled={isPending}
        onFileSelect={handleFileSelect}
        onClear={handleClear}
      />
      {file && !preview && (
        <div className={styles.actions}>
          <Button onClick={handlePreview} disabled={isPending}>
            {isPending ? translate('previewing') : translate('previewButton')}
          </Button>
        </div>
      )}
      {previewError && <ImportErrorPanel error={previewError} />}
      {preview && (
        <ImportPreviewPanel preview={preview} isPending={isPending} onExecute={handleExecute} />
      )}
      {executeError && <ImportErrorPanel error={executeError} />}
    </div>
  );
};
