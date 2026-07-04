'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { ImportDropzone } from '../../../../../components/transaction-import/import-dropzone/ImportDropzone';
import { ImportErrorPanel } from '../../../../../components/transaction-import/import-error-panel/ImportErrorPanel';
import { ImportPreviewPanel } from '../../../../../components/transaction-import/import-preview-panel/ImportPreviewPanel';
import styles from './CategoriesStep.module.scss';
import { useCategoriesStep } from './hooks/use-categories-step';

export const CategoriesStep: FC = () => {
  const translate = useTranslations(I18N_NAMESPACE.onboardingPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.onboardingPage}.errors`);
  const translateImport = useTranslations(I18N_NAMESPACE.transactionsImportPage);
  const {
    importFlow,
    isPending,
    defaultsResult,
    errorCode,
    hasCategoriesReady,
    handleAssignDefaults,
    handleComplete,
  } = useCategoriesStep();
  const { file, checkErrorKey, preview, previewError, report, executeError } = importFlow;

  return (
    <div className={styles.container}>
      <Button
        onClick={handleAssignDefaults}
        disabled={isPending || defaultsResult !== null}
        variant={defaultsResult ? 'outline' : 'primary'}
      >
        {translate('useDefaultsButton')}
      </Button>

      {defaultsResult && (
        <div className={styles.result}>
          <Typography variant="body-m" fontWeight="medium">
            {translate('defaultsResultTitle')}
          </Typography>
          <Typography variant="body-s">
            {translate('defaultsResultTopLevel', { count: defaultsResult.topLevelCreated })}
          </Typography>
          <Typography variant="body-s">
            {translate('defaultsResultChildren', { count: defaultsResult.childrenCreated })}
          </Typography>
        </div>
      )}

      <div className={styles.divider}>
        <span className={styles.dividerLabel}>{translate('orDivider')}</span>
      </div>

      <div className={styles.importSection}>
        <Typography variant="body-m" fontWeight="medium">
          {translate('importSectionLabel')}
        </Typography>
        {!report && (
          <ImportDropzone
            file={file}
            checkErrorKey={checkErrorKey}
            disabled={isPending}
            onFileSelect={importFlow.handleFileSelect}
            onClear={importFlow.handleClear}
          />
        )}
        {file && !preview && !report && (
          <Button onClick={importFlow.handlePreview} disabled={isPending}>
            {isPending ? translateImport('previewing') : translateImport('previewButton')}
          </Button>
        )}
        {previewError && <ImportErrorPanel error={previewError} />}
        {preview && !report && (
          <ImportPreviewPanel
            preview={preview}
            isPending={isPending}
            onExecute={importFlow.handleExecute}
          />
        )}
        {executeError && <ImportErrorPanel error={executeError} />}
      </div>

      {report && (
        <div className={styles.result}>
          <Typography variant="body-m" fontWeight="medium">
            {translate('importResultTitle')}
          </Typography>
          <Typography variant="body-s">
            {translate('importResultInserted', { count: report.inserted })}
          </Typography>
          <Typography variant="body-s">
            {translate('importResultSkipped', { count: report.skippedDuplicates })}
          </Typography>
          <Typography variant="body-s">
            {translate('importResultCategoriesCreated', {
              count: report.topLevelCategoriesCreated,
            })}
          </Typography>
          <Typography variant="body-s">
            {translate('importResultSubcategoriesCreated', {
              count: report.childCategoriesCreated,
            })}
          </Typography>
        </div>
      )}

      {errorCode && (
        <Alert variant="destructive">
          <AlertDescription>
            {translateError.has(errorCode)
              ? translateError(errorCode)
              : translateError(UNKNOWN_ERROR_CODE)}
          </AlertDescription>
        </Alert>
      )}

      <div className={styles.actions}>
        {hasCategoriesReady && (
          <Button onClick={handleComplete} disabled={isPending}>
            {translate('continueButton')}
          </Button>
        )}
        <Button variant="ghost" onClick={handleComplete} disabled={isPending}>
          {translate('skipButton')}
        </Button>
      </div>
    </div>
  );
};
