'use client';

import type { FC } from 'react';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import styles from './BulkDeleteActionBar.module.scss';

interface Props {
  selectedCountLabel: string;
  selectAllLabel: string;
  clearLabel: string;
  deleteLabel: string;
  areAllVisibleSelected: boolean;
  isSubmitting: boolean;
  onSelectAllVisible: () => void;
  onClear: () => void;
  onDelete: () => void;
}

export const BulkDeleteActionBar: FC<Props> = ({
  selectedCountLabel,
  selectAllLabel,
  clearLabel,
  deleteLabel,
  areAllVisibleSelected,
  isSubmitting,
  onSelectAllVisible,
  onClear,
  onDelete,
}) => (
  <div className={styles.bar} role="region" aria-label={selectedCountLabel}>
    <Typography variant="body-m" fontWeight="semibold" className={styles.label}>
      {selectedCountLabel}
    </Typography>
    <div className={styles.actions}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSelectAllVisible}
        disabled={isSubmitting}
        aria-pressed={areAllVisibleSelected}
      >
        {selectAllLabel}
      </Button>
      <Button variant="outline" size="sm" onClick={onClear} disabled={isSubmitting}>
        {clearLabel}
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete} disabled={isSubmitting}>
        {deleteLabel}
      </Button>
    </div>
  </div>
);
