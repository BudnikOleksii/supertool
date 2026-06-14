import { describe, expect, it } from 'vitest';

import type { SeedSourceRecord } from './seed.types';

import { findNearDuplicateCategories } from './find-near-duplicate-categories';

const EXPECTED_CLUSTER_PAIR_SIZE = 2;

const buildRecord = (overrides: Partial<SeedSourceRecord>): SeedSourceRecord => ({
  Date: '02/03/2025 15:41:17',
  Category: 'Транспорт',
  Type: 'Expense',
  Amount: 100,
  Currency: 'UAH',
  ...overrides,
});

describe('findNearDuplicateCategories', () => {
  it('returns no clusters when every name is distinct', () => {
    const inputRecordList = [
      buildRecord({ Category: 'Транспорт' }),
      buildRecord({ Category: 'Донати' }),
    ];

    expect(findNearDuplicateCategories(inputRecordList)).toEqual([]);
  });

  it('surfaces a Latin/Cyrillic confusable pair as one cluster, never merging it', () => {
    const inputRecordList = [
      buildRecord({ Category: 'Транспорт', Subcategory: 'Tаксі' }),
      buildRecord({ Category: 'Транспорт', Subcategory: 'Таксі' }),
    ];

    const [cluster] = findNearDuplicateCategories(inputRecordList);

    expect(cluster).toBeDefined();
    expect(cluster?.rawNameList).toContain('Tаксі');
    expect(cluster?.rawNameList).toContain('Таксі');
    expect(cluster?.hasMixedScript).toBe(true);
  });

  it('does not surface a lone mixed-script name as a cluster', () => {
    const inputRecordList = [buildRecord({ Category: 'Транспорт', Subcategory: 'Tаксі' })];

    expect(findNearDuplicateCategories(inputRecordList)).toEqual([]);
  });

  it('clusters names that differ only by surrounding whitespace and case', () => {
    const inputRecordList = [
      buildRecord({ Category: 'Донати' }),
      buildRecord({ Category: ' донати ' }),
    ];

    const [cluster] = findNearDuplicateCategories(inputRecordList);

    expect(cluster).toBeDefined();
    expect(cluster?.rawNameList).toHaveLength(EXPECTED_CLUSTER_PAIR_SIZE);
  });
});
