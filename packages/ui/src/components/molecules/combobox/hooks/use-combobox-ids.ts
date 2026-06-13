import { useCallback, useId } from 'react';

export const useComboboxIds = () => {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const getOptionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);

  return { listboxId, getOptionId };
};
