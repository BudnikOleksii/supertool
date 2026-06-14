import { describe, expect, it } from 'vitest';

import type { SeedSourceRecord } from './seed.types';

import { deriveCategoryHierarchy } from './derive-category-hierarchy';

const EXPECTED_PAIR_COUNT = 2;

const buildRecord = (overrides: Partial<SeedSourceRecord>): SeedSourceRecord => ({
  Date: '02/03/2025 15:41:17',
  Category: 'Транспорт',
  Type: 'Expense',
  Amount: 100,
  Currency: 'UAH',
  ...overrides,
});

describe('deriveCategoryHierarchy', () => {
  it('promotes each distinct Category to a top-level entry', () => {
    const inputRecordList = [
      buildRecord({ Category: 'Транспорт' }),
      buildRecord({ Category: 'Донати' }),
      buildRecord({ Category: 'Транспорт' }),
    ];

    const { topLevelList } = deriveCategoryHierarchy(inputRecordList);
    const topLevelNameList = topLevelList.map((entry) => entry.name);

    expect(topLevelNameList).toHaveLength(EXPECTED_PAIR_COUNT);
    expect(topLevelNameList).toContain('Транспорт');
    expect(topLevelNameList).toContain('Донати');
  });

  it('attaches each distinct Subcategory to its parent Category', () => {
    const inputRecordList = [
      buildRecord({ Category: 'Транспорт', Subcategory: 'Tаксі' }),
      buildRecord({ Category: 'Транспорт', Subcategory: 'Паливо' }),
    ];

    const { childList } = deriveCategoryHierarchy(inputRecordList);

    expect(childList).toHaveLength(EXPECTED_PAIR_COUNT);
    expect(childList.every((child) => child.parentName === 'Транспорт')).toBe(true);
  });

  it('derives the category type from the records, not a hardcoded value', () => {
    const inputRecordList = [buildRecord({ Category: 'Зарплата', Type: 'Income' })];

    const { topLevelList } = deriveCategoryHierarchy(inputRecordList);

    expect(topLevelList[0]).toEqual({ name: 'Зарплата', type: 'income' });
  });

  it('keeps a name that exists at both levels as separate top-level and child entries', () => {
    const inputRecordList = [
      buildRecord({ Category: 'Одяг' }),
      buildRecord({ Category: 'Побутові', Subcategory: 'Одяг' }),
    ];

    const { topLevelList, childList } = deriveCategoryHierarchy(inputRecordList);

    expect(topLevelList.some((entry) => entry.name === 'Одяг')).toBe(true);
    expect(
      childList.some((child) => child.name === 'Одяг' && child.parentName === 'Побутові'),
    ).toBe(true);
  });
});
