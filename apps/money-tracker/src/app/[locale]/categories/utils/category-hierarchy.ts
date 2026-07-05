import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

export interface HierarchyNode {
  id: string;
  parentId: string | null;
}

export interface CategoryHierarchy<T extends HierarchyNode = CategoryResponseDto> {
  topLevelList: T[];
  childrenByParentId: Map<string, T[]>;
}

const buildChildrenByParentId = <T extends HierarchyNode>(categoryList: T[]): Map<string, T[]> => {
  const childrenByParentId = new Map<string, T[]>();

  for (const category of categoryList) {
    if (category.parentId !== null) {
      const siblingList = childrenByParentId.get(category.parentId) ?? [];
      siblingList.push(category);
      childrenByParentId.set(category.parentId, siblingList);
    }
  }

  return childrenByParentId;
};

export const buildCategoryHierarchy = <T extends HierarchyNode>(
  categoryList: T[],
): CategoryHierarchy<T> => ({
  topLevelList: categoryList.filter((category) => category.parentId === null),
  childrenByParentId: buildChildrenByParentId(categoryList),
});

const collectFreshChildren = <T extends HierarchyNode>(
  childList: T[],
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

export const getDescendantIdSet = <T extends HierarchyNode>(
  categoryList: T[],
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
