'use client';

import { useCallback, useState } from 'react';

export type BarMessage =
  | { kind: 'partial'; deletedCount: number; failedCount: number }
  | { kind: 'overCap' };

interface UseBarMessageResult {
  barMessage: BarMessage | null;
  notifyOverCap: () => void;
  notifyPartialFailure: (deletedCount: number, failedCount: number) => void;
  clearBarMessage: () => void;
}

export const useBarMessage = (): UseBarMessageResult => {
  const [barMessage, setBarMessage] = useState<BarMessage | null>(null);

  const notifyOverCap = useCallback(() => {
    setBarMessage({ kind: 'overCap' });
  }, []);

  const notifyPartialFailure = useCallback((deletedCount: number, failedCount: number) => {
    setBarMessage({ kind: 'partial', deletedCount, failedCount });
  }, []);

  const clearBarMessage = useCallback(() => {
    setBarMessage(null);
  }, []);

  return { barMessage, notifyOverCap, notifyPartialFailure, clearBarMessage };
};
