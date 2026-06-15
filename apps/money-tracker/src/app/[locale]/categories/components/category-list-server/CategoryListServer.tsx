import type { FC } from 'react';

import { fetchCategoryList } from '../../../../../actions/fetch-category-list';
import { CategoryTree } from '../category-tree/CategoryTree';

export const CategoryListServer: FC = async () => {
  const categoryList = await fetchCategoryList();

  return <CategoryTree categoryList={categoryList} />;
};
