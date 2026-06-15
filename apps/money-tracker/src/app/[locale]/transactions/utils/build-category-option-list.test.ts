import { describe, expect, it } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { buildCategoryOptionList } from './build-category-option-list';

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

describe('buildCategoryOptionList', () => {
  it('keeps only categories matching the requested type', () => {
    const actual = buildCategoryOptionList(CATEGORY_LIST, 'income');

    expect(actual).toEqual([{ value: 'salary', label: 'Salary' }]);
  });

  it('labels a child category as "Parent / Child" and orders it after its parent', () => {
    const actual = buildCategoryOptionList(CATEGORY_LIST, 'expense');

    expect(actual).toEqual([
      { value: 'food', label: 'Food' },
      { value: 'groceries', label: 'Food / Groceries' },
    ]);
  });
});
