'use client';

import type { FC } from 'react';

import { Checkbox } from '@supertool/ui/src/components/atoms/checkbox/Checkbox';

import { useBulkDeleteContext } from './BulkDeleteContext';

interface Props {
  id: string;
  label: string;
}

export const TransactionSelectCheckbox: FC<Props> = ({ id, label }) => {
  const { selectedIdSet, isSubmitting, onToggleSelection } = useBulkDeleteContext();

  return (
    <Checkbox
      checked={selectedIdSet.has(id)}
      disabled={isSubmitting}
      aria-label={label}
      onCheckedChange={() => {
        onToggleSelection(id);
      }}
    />
  );
};
