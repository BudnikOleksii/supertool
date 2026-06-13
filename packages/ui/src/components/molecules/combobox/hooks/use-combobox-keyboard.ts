import type { Dispatch, KeyboardEvent, SetStateAction } from 'react';

import { useCallback } from 'react';

import type { ComboboxOption } from '../Combobox';

const FIRST_INDEX = 0;
const INDEX_OFFSET = 1;
const EMPTY_OPTION_COUNT = 0;

interface UseComboboxKeyboardConfig {
  filteredOptionList: ComboboxOption[];
  highlightedIndex: number;
  setHighlightedIndex: Dispatch<SetStateAction<number>>;
  handleSelect: (value: string) => void;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export const useComboboxKeyboard = ({
  filteredOptionList,
  highlightedIndex,
  setHighlightedIndex,
  handleSelect,
  setIsOpen,
}: UseComboboxKeyboardConfig) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const optionCount = filteredOptionList.length;

      const keyActionMap: Record<string, () => void> = {
        ArrowDown: () => setHighlightedIndex((prev) => (prev + INDEX_OFFSET) % optionCount),
        ArrowUp: () =>
          setHighlightedIndex((prev) =>
            prev <= FIRST_INDEX ? optionCount - INDEX_OFFSET : prev - INDEX_OFFSET,
          ),
        Home: () => setHighlightedIndex(FIRST_INDEX),
        End: () => setHighlightedIndex(optionCount - INDEX_OFFSET),
        Enter: () => {
          const option = filteredOptionList[highlightedIndex];
          if (option) {
            handleSelect(option.value);
          }
        },
        Escape: () => setIsOpen(false),
      };

      const action = keyActionMap[event.key];
      const isNavigationOnEmptyList = optionCount === EMPTY_OPTION_COUNT && event.key !== 'Escape';
      if (action && !isNavigationOnEmptyList) {
        event.preventDefault();
        action();
      }
    },
    [filteredOptionList, highlightedIndex, setHighlightedIndex, handleSelect, setIsOpen],
  );

  return handleKeyDown;
};
