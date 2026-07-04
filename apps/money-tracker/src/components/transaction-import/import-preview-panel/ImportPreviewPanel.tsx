'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { TransactionImportPreviewResponseDto } from '@supertool/shared/generated/types.gen';
import { Badge } from '@supertool/ui/src/components/atoms/badge/Badge';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { NearDuplicateAlert } from '../near-duplicate-alert/NearDuplicateAlert';
import styles from './ImportPreviewPanel.module.scss';

const EMPTY_LIST_LENGTH = 0;
const NO_NEW_ROWS = 0;

interface Props {
  preview: TransactionImportPreviewResponseDto;
  isPending: boolean;
  onExecute: () => void;
}

interface CategoryListBlockProps {
  title: string;
  nameList: string[];
}

const CategoryListBlock: FC<CategoryListBlockProps> = ({ title, nameList }) => {
  if (nameList.length === EMPTY_LIST_LENGTH) {
    return null;
  }

  return (
    <div className={styles.categoryBlock}>
      <Typography variant="body-m" fontWeight="medium">
        {title}
      </Typography>
      <ul className={styles.categoryList}>
        {nameList.map((name) => (
          <li key={name} className={styles.categoryItem}>
            <Badge variant="secondary">{name}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ImportPreviewPanel: FC<Props> = ({ preview, isPending, onExecute }) => {
  const translate = useTranslations(I18N_NAMESPACE.transactionsImportPage);

  return (
    <section className={styles.panel} aria-label={translate('previewTitle')}>
      <Typography variant="title-s">{translate('previewTitle')}</Typography>
      <div className={styles.counts}>
        <Typography variant="body-m">
          {translate('totalRows', { count: preview.totalRows })}
        </Typography>
        <Typography variant="body-m">{translate('newRows', { count: preview.newRows })}</Typography>
        <Typography variant="body-m">
          {translate('duplicateRows', { count: preview.duplicateRows })}
        </Typography>
      </div>
      <CategoryListBlock
        title={translate('topLevelCategoriesToCreate')}
        nameList={preview.topLevelCategoriesToCreateList}
      />
      <CategoryListBlock
        title={translate('childCategoriesToCreate')}
        nameList={preview.childCategoriesToCreateList}
      />
      <NearDuplicateAlert clusterList={preview.nearDuplicateClusterList} />
      <Typography variant="body-s" className={styles.hint}>
        {translate('previewHint')}
      </Typography>
      <div className={styles.actions}>
        <Button onClick={onExecute} disabled={isPending || preview.newRows === NO_NEW_ROWS}>
          {isPending
            ? translate('importing')
            : translate('executeButton', { count: preview.newRows })}
        </Button>
      </div>
    </section>
  );
};
