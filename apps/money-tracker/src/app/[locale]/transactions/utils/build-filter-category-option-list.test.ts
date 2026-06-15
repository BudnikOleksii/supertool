import { describe, expect, it } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { buildFilterCategoryOptionList } from './build-filter-category-option-list';

const TIMESTAMP = '2025-02-03T00:00:00.000Z';

const buildCategory = (
  override: Partial<CategoryResponseDto> & Pick<CategoryResponseDto, 'id' | 'name' | 'type'>,
): CategoryResponseDto => ({
  parentId: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...override,
});

const CATEGORY_LIST: CategoryResponseDto[] = [
  buildCategory({ id: 'food', name: 'Food', type: 'expense' }),
  buildCategory({ id: 'groceries', name: 'Groceries', type: 'expense', parentId: 'food' }),
  buildCategory({ id: 'salary', name: 'Salary', type: 'income' }),
];

describe('buildFilterCategoryOptionList', () => {
  it('lists both income and expense categories when no type is given', () => {
    const actual = buildFilterCategoryOptionList(CATEGORY_LIST);

    expect(actual).toEqual([
      { value: 'food', label: 'Food' },
      { value: 'groceries', label: 'Food / Groceries' },
      { value: 'salary', label: 'Salary' },
    ]);
  });

  it('scopes the options to the active type when one is supplied', () => {
    const actual = buildFilterCategoryOptionList(CATEGORY_LIST, 'income');

    expect(actual).toEqual([{ value: 'salary', label: 'Salary' }]);
  });

  it('labels a child category as "Parent / Child" after its parent', () => {
    const actual = buildFilterCategoryOptionList(CATEGORY_LIST, 'expense');

    expect(actual).toEqual([
      { value: 'food', label: 'Food' },
      { value: 'groceries', label: 'Food / Groceries' },
    ]);
  });
});
