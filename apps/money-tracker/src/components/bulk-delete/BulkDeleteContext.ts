'use client';

import { createContext, useContext } from 'react';

export interface BulkDeleteContextValue {
  selectedIdSet: ReadonlySet<string>;
  isSubmitting: boolean;
  onToggleSelection: (id: string) => void;
}

export const BulkDeleteContext = createContext<BulkDeleteContextValue | null>(null);

export const useBulkDeleteContext = (): BulkDeleteContextValue => {
  const value = useContext(BulkDeleteContext);

  if (!value) {
    throw new Error('useBulkDeleteContext must be used within a BulkDeleteProvider');
  }

  return value;
};
