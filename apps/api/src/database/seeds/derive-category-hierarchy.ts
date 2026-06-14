import type { TransactionType } from '../schemas/enums';
import type {
  CategoryHierarchy,
  ChildCategory,
  SeedSourceRecord,
  TopLevelCategory,
} from './seed.types';

import { normalizeTransactionType } from './normalize-transaction-type';

interface CategoryNode {
  type: TransactionType;
  subcategoryNameList: Set<string>;
}

export const deriveCategoryHierarchy = (recordList: SeedSourceRecord[]): CategoryHierarchy => {
  const categoryMap = new Map<string, CategoryNode>();

  recordList.forEach((record) => {
    const type = normalizeTransactionType(record.Type);
    const node = categoryMap.get(record.Category) ?? { type, subcategoryNameList: new Set() };

    if (record.Subcategory) {
      node.subcategoryNameList.add(record.Subcategory);
    }

    categoryMap.set(record.Category, node);
  });

  const topLevelList: TopLevelCategory[] = [];
  const childList: ChildCategory[] = [];

  categoryMap.forEach((node, name) => {
    topLevelList.push({ name, type: node.type });
    node.subcategoryNameList.forEach((subcategoryName) => {
      childList.push({ name: subcategoryName, type: node.type, parentName: name });
    });
  });

  return { topLevelList, childList };
};
