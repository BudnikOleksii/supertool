import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CategoryResponseDto, TransactionType } from '@supertool/shared/generated/types.gen';

import { EMPTY_LIST_LENGTH } from '../constants';

interface UseCategoryPickerParams {
  categoryList: CategoryResponseDto[];
  transactionType: TransactionType | '';
  value: string;
  showAllOption: boolean;
  allCategoriesLabel: string;
  onValueChange: (categoryId: string) => void;
}

interface UseCategoryDataParams {
  categoryList: CategoryResponseDto[];
  transactionType: TransactionType | '';
  value: string;
  showAllOption: boolean;
  allCategoriesLabel: string;
}

const useCategoryData = ({
  categoryList,
  transactionType,
  value,
  showAllOption,
  allCategoriesLabel,
}: UseCategoryDataParams) => {
  const checkMatchesType = useCallback(
    (category: CategoryResponseDto) => transactionType === '' || category.type === transactionType,
    [transactionType],
  );

  const mainCategoryList = useMemo(
    () =>
      categoryList.filter((category) => category.parentId === null && checkMatchesType(category)),
    [categoryList, checkMatchesType],
  );

  const subcategoryMap = useMemo(() => {
    const map = new Map<string, CategoryResponseDto[]>();

    for (const category of categoryList) {
      if (category.parentId !== null && checkMatchesType(category)) {
        const existing = map.get(category.parentId) ?? [];
        existing.push(category);
        map.set(category.parentId, existing);
      }
    }

    return map;
  }, [categoryList, checkMatchesType]);

  const selectedCategory = useMemo(
    () =>
      categoryList.find((category) => category.id === value && checkMatchesType(category)) ?? null,
    [categoryList, value, checkMatchesType],
  );

  const selectedDisplayName = useMemo(() => {
    if (value === '') {
      return showAllOption ? allCategoriesLabel : '';
    }

    if (selectedCategory === null) {
      return '';
    }

    if (selectedCategory.parentId !== null) {
      const parent = categoryList.find((category) => category.id === selectedCategory.parentId);

      return parent ? `${parent.name} / ${selectedCategory.name}` : selectedCategory.name;
    }

    return selectedCategory.name;
  }, [selectedCategory, categoryList, value, showAllOption, allCategoriesLabel]);

  const selectedMainCategoryId = selectedCategory?.parentId ?? selectedCategory?.id ?? null;

  return { mainCategoryList, subcategoryMap, selectedDisplayName, selectedMainCategoryId };
};

export const useCategoryPicker = ({
  categoryList,
  transactionType,
  value,
  showAllOption,
  allCategoriesLabel,
  onValueChange,
}: UseCategoryPickerParams) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const { mainCategoryList, subcategoryMap, selectedDisplayName, selectedMainCategoryId } =
    useCategoryData({ categoryList, transactionType, value, showAllOption, allCategoriesLabel });

  const activeSubcategoryList = useMemo(
    () => (activeCategoryId === null ? [] : (subcategoryMap.get(activeCategoryId) ?? [])),
    [activeCategoryId, subcategoryMap],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setActiveCategoryId(selectedMainCategoryId);

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, selectedMainCategoryId]);

  const handleToggle = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  const handleSelectAndClose = useCallback(
    (categoryId: string) => {
      onValueChange(categoryId);
      setIsOpen(false);
    },
    [onValueChange],
  );

  const handleMainCategoryClick = useCallback(
    (categoryId: string) => {
      setActiveCategoryId(categoryId);

      if (!subcategoryMap.has(categoryId)) {
        handleSelectAndClose(categoryId);
      }
    },
    [subcategoryMap, handleSelectAndClose],
  );

  return {
    isOpen,
    rootRef,
    mainCategoryList,
    subcategoryMap,
    activeSubcategoryList,
    hasActiveSubcategories: activeSubcategoryList.length > EMPTY_LIST_LENGTH,
    activeCategoryId,
    selectedDisplayName,
    selectedMainCategoryId,
    handleToggle,
    handleMainCategoryClick,
    handleSubcategoryClick: handleSelectAndClose,
    handleAllCategoriesClick: handleSelectAndClose,
    handleActivateCategory: setActiveCategoryId,
  };
};
