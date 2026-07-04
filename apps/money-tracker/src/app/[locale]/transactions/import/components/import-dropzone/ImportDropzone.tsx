'use client';

import type { FC } from 'react';

import { Upload } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { TRANSACTION_IMPORT_MAX_FILE_SIZE_MEBIBYTES } from '@supertool/shared/constants/transaction-import';
import { Alert, AlertDescription } from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@supertool/ui/src/components/molecules/field/Field';
import { cn } from '@supertool/ui/src/lib/utils';

import type { ImportFileCheckErrorKey } from '../../utils/check-import-file';

import { formatFileSize } from '../../utils/format-file-size';
import { useImportDropzone } from './hooks/use-import-dropzone';
import styles from './ImportDropzone.module.scss';

interface Props {
  file: File | null;
  checkErrorKey: ImportFileCheckErrorKey | null;
  disabled: boolean;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

export const ImportDropzone: FC<Props> = ({
  file,
  checkErrorKey,
  disabled,
  onFileSelect,
  onClear,
}) => {
  const translate = useTranslations(I18N_NAMESPACE.transactionsImportPage);
  const translateError = useTranslations(`${I18N_NAMESPACE.transactionsImportPage}.errors`);
  const locale = useLocale();
  const {
    inputRef,
    isDragOver,
    handleBrowseClick,
    handleInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImportDropzone({ disabled, onFileSelect });

  return (
    <Field>
      <FieldLabel htmlFor="import-file">{translate('dropzoneLabel')}</FieldLabel>
      <FieldDescription>{translate('dropzoneDescription')}</FieldDescription>
      <input
        ref={inputRef}
        id="import-file"
        className={styles.hiddenInput}
        type="file"
        accept=".json,.csv"
        disabled={disabled}
        onChange={handleInputChange}
      />
      {file ? (
        <div className={styles.fileCard}>
          <div className={styles.fileMeta}>
            <Typography variant="body-m" fontWeight="medium" className={styles.fileName}>
              {file.name}
            </Typography>
            <Typography variant="body-s" className={styles.fileSize}>
              {formatFileSize(file.size, locale)}
            </Typography>
          </div>
          <div className={styles.fileActions}>
            <Button variant="outline" size="sm" disabled={disabled} onClick={handleBrowseClick}>
              {translate('replaceFile')}
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
              {translate('clearFile')}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(styles.dropzone, isDragOver && styles.dropzoneDragOver)}
          data-drag-over={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={styles.icon} aria-hidden />
          <Typography variant="body-m">{translate('dropzoneInstruction')}</Typography>
          <Button variant="outline" disabled={disabled} onClick={handleBrowseClick}>
            {translate('dropzoneBrowse')}
          </Button>
          <Typography variant="body-s" className={styles.hint}>
            {translate('dropzoneHint', {
              maxSizeMegabytes: TRANSACTION_IMPORT_MAX_FILE_SIZE_MEBIBYTES,
            })}
          </Typography>
        </div>
      )}
      {checkErrorKey && (
        <Alert variant="destructive">
          <AlertDescription>
            {translateError(checkErrorKey, {
              maxSizeMegabytes: TRANSACTION_IMPORT_MAX_FILE_SIZE_MEBIBYTES,
            })}
          </AlertDescription>
        </Alert>
      )}
    </Field>
  );
};
