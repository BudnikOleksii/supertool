import { useCallback, useEffect, useRef, useState } from 'react';

const NO_HIGHLIGHT = -1;

export const FIRST_INDEX = 0;

export const useComboboxHighlight = () => {
  const [highlightedIndex, setHighlightedIndex] = useState(NO_HIGHLIGHT);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedIndex === NO_HIGHLIGHT) {
      return;
    }

    const optionElement = listRef.current?.children[highlightedIndex];
    if (optionElement instanceof HTMLElement) {
      optionElement.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const resetHighlight = useCallback(() => {
    setHighlightedIndex(NO_HIGHLIGHT);
  }, []);

  return { highlightedIndex, setHighlightedIndex, listRef, resetHighlight };
};
