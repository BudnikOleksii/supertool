import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

export interface CategoryHierarchy {
  topLevelList: CategoryResponseDto[];
  childrenByParentId: Map<string, CategoryResponseDto[]>;
}

const buildChildrenByParentId = (
  categoryList: CategoryResponseDto[],
): Map<string, CategoryResponseDto[]> => {
  const childrenByParentId = new Map<string, CategoryResponseDto[]>();

  for (const category of categoryList) {
    if (category.parentId !== null) {
      const siblingList = childrenByParentId.get(category.parentId) ?? [];
      siblingList.push(category);
      childrenByParentId.set(category.parentId, siblingList);
    }
  }

  return childrenByParentId;
};

export const buildCategoryHierarchy = (categoryList: CategoryResponseDto[]): CategoryHierarchy => ({
  topLevelList: categoryList.filter((category) => category.parentId === null),
  childrenByParentId: buildChildrenByParentId(categoryList),
});

const collectFreshChildren = (
  childList: CategoryResponseDto[],
  descendantIdSet: Set<string>,
  pendingIdList: string[],
): void => {
  for (const child of childList) {
    if (!descendantIdSet.has(child.id)) {
      descendantIdSet.add(child.id);
      pendingIdList.push(child.id);
    }
  }
};

export const getDescendantIdSet = (
  categoryList: CategoryResponseDto[],
  categoryId: string,
): Set<string> => {
  const childrenByParentId = buildChildrenByParentId(categoryList);
  const descendantIdSet = new Set<string>();
  const pendingIdList = [categoryId];

  while (pendingIdList.length) {
    const currentId = pendingIdList.pop();
    const childList = currentId === undefined ? [] : (childrenByParentId.get(currentId) ?? []);
    collectFreshChildren(childList, descendantIdSet, pendingIdList);
  }

  return descendantIdSet;
};
