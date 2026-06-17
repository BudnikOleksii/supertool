'use client';

import type { FC, KeyboardEvent } from 'react';

import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import type { CategoryResponseDto, TransactionType } from '@supertool/shared/generated/types.gen';
import { cn } from '@supertool/ui/src/lib/utils';

import styles from './CategoryPicker.module.scss';
import { CHEVRON_SIZE, CHEVRON_SMALL_SIZE } from './constants';
import { useCategoryPicker } from './hooks/use-category-picker';

const MAIN_LIST_INDEX = 0;
const SUBCATEGORY_LIST_INDEX = 1;
const LAST_INDEX_OFFSET = 1;

interface ArrowNavigationContext {
  pickerElement: HTMLDivElement;
  activeCategoryId: string | null;
  onActivateCategory: (id: string) => void;
}

const getVerticalSibling = (key: string, target: HTMLElement): HTMLElement | null => {
  const sibling = key === 'ArrowDown' ? target.nextElementSibling : target.previousElementSibling;

  return sibling instanceof HTMLElement ? sibling : null;
};

const getLateralFocusTarget = (
  key: string,
  target: HTMLElement,
  context: ArrowNavigationContext,
): HTMLElement | null => {
  const currentListbox = target.closest('[role="listbox"]');
  const listboxList = context.pickerElement.querySelectorAll<HTMLElement>('[role="listbox"]');

  if (key === 'ArrowRight' && currentListbox === listboxList[MAIN_LIST_INDEX]) {
    return (
      listboxList[SUBCATEGORY_LIST_INDEX]?.querySelector<HTMLElement>('[role="option"]') ?? null
    );
  }

  if (key === 'ArrowLeft' && currentListbox === listboxList[SUBCATEGORY_LIST_INDEX]) {
    const selector =
      context.activeCategoryId === null
        ? '[role="option"]'
        : `[data-category-id="${context.activeCategoryId}"]`;

    return listboxList[MAIN_LIST_INDEX]?.querySelector<HTMLElement>(selector) ?? null;
  }

  return null;
};

const getArrowFocusTarget = (
  key: string,
  target: HTMLElement,
  context: ArrowNavigationContext,
): HTMLElement | null =>
  key === 'ArrowDown' || key === 'ArrowUp'
    ? getVerticalSibling(key, target)
    : getLateralFocusTarget(key, target, context);

const handleArrowNavigation = (event: KeyboardEvent, context: ArrowNavigationContext): void => {
  if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'option') {
    return;
  }

  const focusTarget = getArrowFocusTarget(event.key, event.target, context);

  if (focusTarget === null) {
    return;
  }

  event.preventDefault();
  focusTarget.focus();

  if (focusTarget.dataset.categoryId !== undefined) {
    context.onActivateCategory(focusTarget.dataset.categoryId);
  }
};

interface Props {
  categoryList: CategoryResponseDto[];
  transactionType: TransactionType | '';
  value: string;
  onValueChange: (categoryId: string) => void;
  placeholder: string;
  ariaLabel: string;
  getParentOptionLabel: (parentName: string) => string;
  showAllOption?: boolean;
  allCategoriesLabel?: string;
  error?: boolean;
}

export const CategoryPicker: FC<Props> = ({
  categoryList,
  transactionType,
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  getParentOptionLabel,
  showAllOption = false,
  allCategoriesLabel = '',
  error = false,
}) => {
  const {
    isOpen,
    rootRef,
    mainCategoryList,
    subcategoryMap,
    activeSubcategoryList,
    hasActiveSubcategories,
    activeCategoryId,
    selectedDisplayName,
    selectedMainCategoryId,
    handleToggle,
    handleMainCategoryClick,
    handleSubcategoryClick,
    handleAllCategoriesClick,
    handleActivateCategory,
  } = useCategoryPicker({
    categoryList,
    transactionType,
    value,
    showAllOption,
    allCategoriesLabel,
    onValueChange,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    if (!isOpen || pickerRef.current === null) {
      return;
    }

    const selectedList = pickerRef.current.querySelectorAll<HTMLElement>(
      '[role="option"][aria-selected="true"]',
    );
    const selected = selectedList[selectedList.length - LAST_INDEX_OFFSET] ?? null;
    const firstOption = pickerRef.current.querySelector<HTMLElement>('[role="option"]');

    (selected ?? firstOption)?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen && document.activeElement === document.body) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handlePickerKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleToggle();
        triggerRef.current?.focus();

        return;
      }

      if (pickerRef.current !== null) {
        handleArrowNavigation(event, {
          pickerElement: pickerRef.current,
          activeCategoryId,
          onActivateCategory: handleActivateCategory,
        });
      }
    },
    [handleToggle, activeCategoryId, handleActivateCategory],
  );

  const activeMainCategoryName = mainCategoryList.find(
    (category) => category.id === activeCategoryId,
  )?.name;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(styles.trigger, error && styles.triggerError)}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className={cn(selectedDisplayName === '' && styles.placeholder)}>
          {selectedDisplayName === '' ? placeholder : selectedDisplayName}
        </span>
        <ChevronRight
          size={CHEVRON_SIZE}
          className={cn(styles.chevron, isOpen && styles.chevronOpen)}
        />
      </button>

      {isOpen && (
        <div ref={pickerRef} className={styles.picker} onKeyDown={handlePickerKeyDown}>
          <div className={styles.mainList} role="listbox" aria-label={ariaLabel}>
            {showAllOption && (
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                className={cn(styles.categoryItem, value === '' && styles.categoryItemSelected)}
                onClick={() => {
                  handleAllCategoriesClick('');
                }}
              >
                <span className={styles.categoryName}>{allCategoriesLabel}</span>
              </button>
            )}
            {mainCategoryList.map((category) => {
              const hasSubcategories = subcategoryMap.has(category.id);
              const isActive = activeCategoryId === category.id;
              const isSelected = selectedMainCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  role="option"
                  data-category-id={category.id}
                  aria-selected={isSelected}
                  className={cn(
                    styles.categoryItem,
                    isActive && styles.categoryItemActive,
                    isSelected && styles.categoryItemSelected,
                  )}
                  onClick={() => {
                    handleMainCategoryClick(category.id);
                  }}
                >
                  <span className={styles.categoryName}>{category.name}</span>
                  {hasSubcategories && (
                    <ChevronRight size={CHEVRON_SMALL_SIZE} className={styles.itemChevron} />
                  )}
                </button>
              );
            })}
          </div>

          {hasActiveSubcategories && (
            <div
              className={styles.subList}
              role="listbox"
              aria-label={activeMainCategoryName ?? ariaLabel}
            >
              {activeCategoryId !== null && (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === activeCategoryId}
                  className={cn(
                    styles.categoryItem,
                    value === activeCategoryId && styles.categoryItemSelected,
                  )}
                  onClick={() => {
                    handleSubcategoryClick(activeCategoryId);
                  }}
                >
                  <span className={styles.categoryName}>
                    {getParentOptionLabel(activeMainCategoryName ?? '')}
                  </span>
                </button>
              )}
              {activeSubcategoryList.map((subcategory) => (
                <button
                  key={subcategory.id}
                  type="button"
                  role="option"
                  aria-selected={value === subcategory.id}
                  className={cn(
                    styles.categoryItem,
                    value === subcategory.id && styles.categoryItemSelected,
                  )}
                  onClick={() => {
                    handleSubcategoryClick(subcategory.id);
                  }}
                >
                  <span className={styles.categoryName}>{subcategory.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
