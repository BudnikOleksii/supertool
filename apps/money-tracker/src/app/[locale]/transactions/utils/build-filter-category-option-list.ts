import type { CategoryResponseDto, TransactionType } from '@supertool/shared/generated/types.gen';
import type { ComboboxOption } from '@supertool/ui/src/components/molecules/combobox/Combobox';

import { buildCategoryHierarchy } from '../../categories/utils/category-hierarchy';

export const buildFilterCategoryOptionList = (
  categoryList: CategoryResponseDto[],
  type?: TransactionType,
): ComboboxOption[] => {
  const { topLevelList, childrenByParentId } = buildCategoryHierarchy(categoryList);
  const parentList =
    type === undefined ? topLevelList : topLevelList.filter((parent) => parent.type === type);
  const optionList: ComboboxOption[] = [];

  for (const parent of parentList) {
    optionList.push({ value: parent.id, label: parent.name });

    for (const child of childrenByParentId.get(parent.id) ?? []) {
      optionList.push({ value: child.id, label: `${parent.name} / ${child.name}` });
    }
  }

  return optionList;
};
