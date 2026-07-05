import { useCallback, useEffect, useRef } from 'react';

export const useDebouncedCallback = <Args extends unknown[]>(
  callback: (...argList: Args) => void,
  delayMs: number,
): ((...argList: Args) => void) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  useEffect(
    () => () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return useCallback(
    (...argList: Args) => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...argList);
      }, delayMs);
    },
    [delayMs],
  );
};
