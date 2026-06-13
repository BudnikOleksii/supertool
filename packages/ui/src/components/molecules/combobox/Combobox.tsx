'use client';

import type { FC } from 'react';

import { Content, Portal, Root, Trigger } from '@radix-ui/react-popover';
import { useCallback, useMemo } from 'react';

import { cn } from '../../../lib/utils';
import styles from './Combobox.module.scss';
import { FIRST_INDEX, useComboboxHighlight } from './hooks/use-combobox-highlight';
import { useComboboxIds } from './hooks/use-combobox-ids';
import { useComboboxKeyboard } from './hooks/use-combobox-keyboard';
import { useComboboxSearch } from './hooks/use-combobox-search';

const EMPTY_LIST_LENGTH = 0;
const SIDE_OFFSET = 4;

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  optionList: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchLabel?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  container?: HTMLElement | null;
}

export const Combobox: FC<ComboboxProps> = ({
  optionList,
  value,
  onValueChange,
  placeholder = 'Search...',
  emptyMessage = 'No results',
  searchLabel = 'Search options',
  className,
  error,
  disabled,
  container,
}) => {
  const { listboxId, getOptionId } = useComboboxIds();
  const highlight = useComboboxHighlight();
  const comboboxSearch = useComboboxSearch({
    onClose: highlight.resetHighlight,
    onSearchChange: highlight.resetHighlight,
  });

  const selectedLabel = useMemo(
    () => optionList.find((option) => option.value === value)?.label,
    [optionList, value],
  );

  const filteredOptionList = useMemo(() => {
    if (!comboboxSearch.search) {
      return optionList;
    }

    const lowerSearch = comboboxSearch.search.toLowerCase();

    return optionList.filter((option) => option.label.toLowerCase().includes(lowerSearch));
  }, [optionList, comboboxSearch.search]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onValueChange?.(optionValue === value ? '' : optionValue);
      comboboxSearch.setSearch('');
      comboboxSearch.setIsOpen(false);
    },
    [onValueChange, value, comboboxSearch],
  );

  const handleKeyDown = useComboboxKeyboard({
    filteredOptionList,
    highlightedIndex: highlight.highlightedIndex,
    setHighlightedIndex: highlight.setHighlightedIndex,
    handleSelect,
    setIsOpen: comboboxSearch.setIsOpen,
  });

  return (
    <Root open={comboboxSearch.isOpen} onOpenChange={comboboxSearch.handleOpenChange}>
      <Trigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={comboboxSearch.isOpen}
          aria-controls={listboxId}
          aria-label={selectedLabel ?? placeholder}
          data-slot="combobox-trigger"
          className={cn(styles.trigger, error && styles.error, className)}
          disabled={disabled}
        >
          <span className={cn(styles.triggerText, !selectedLabel && styles.placeholder)}>
            {selectedLabel ?? placeholder}
          </span>
          <span className={styles.icon} aria-hidden>
            ▼
          </span>
        </button>
      </Trigger>
      <Portal container={container}>
        <Content
          data-slot="combobox-content"
          className={styles.content}
          sideOffset={SIDE_OFFSET}
          align="start"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            comboboxSearch.inputRef.current?.focus();
          }}
        >
          <div className={styles.searchWrapper}>
            <input
              ref={comboboxSearch.inputRef}
              data-slot="combobox-input"
              role="combobox"
              aria-expanded={comboboxSearch.isOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                highlight.highlightedIndex >= FIRST_INDEX
                  ? getOptionId(highlight.highlightedIndex)
                  : undefined
              }
              aria-autocomplete="list"
              aria-label={searchLabel}
              className={styles.searchInput}
              placeholder={placeholder}
              value={comboboxSearch.search}
              onChange={(event) => {
                comboboxSearch.setSearch(event.target.value);
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div ref={highlight.listRef} id={listboxId} role="listbox" className={styles.list}>
            {filteredOptionList.length === EMPTY_LIST_LENGTH ? (
              <div className={styles.empty}>{emptyMessage}</div>
            ) : (
              filteredOptionList.map((option, index) => (
                <div
                  key={option.value}
                  id={getOptionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  data-slot="combobox-item"
                  className={cn(
                    styles.item,
                    option.value === value && styles.selected,
                    index === highlight.highlightedIndex && styles.highlighted,
                  )}
                  onClick={() => {
                    handleSelect(option.value);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      className={styles.checkIcon}
                      aria-hidden
                    >
                      <path
                        d="M1 4l3 3 5-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              ))
            )}
          </div>
        </Content>
      </Portal>
    </Root>
  );
};
