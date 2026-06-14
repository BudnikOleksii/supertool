import { describe, expect, it } from 'vitest';

import type { SeedSourceRecord } from './seed.types';

import { buildImportKey } from './build-import-key';

const inputRecord: SeedSourceRecord = {
  Date: '02/03/2025 15:41:12',
  Category: 'Транспорт',
  Type: 'Expense',
  Amount: 303,
  Currency: 'UAH',
  Subcategory: 'Tаксі',
};

describe('buildImportKey', () => {
  it('is deterministic for the same record and row index', () => {
    const first = buildImportKey({ record: inputRecord, rowIndex: 1 });
    const second = buildImportKey({ record: inputRecord, rowIndex: 1 });

    expect(first).toBe(second);
  });

  it('produces a 64-character SHA-256 hex digest', () => {
    const actual = buildImportKey({ record: inputRecord, rowIndex: 0 });

    expect(actual).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('changes when the source row index changes', () => {
    const atIndexOne = buildImportKey({ record: inputRecord, rowIndex: 1 });
    const atIndexTwo = buildImportKey({ record: inputRecord, rowIndex: 2 });

    expect(atIndexOne).not.toBe(atIndexTwo);
  });

  it('changes when a normalized field changes', () => {
    const original = buildImportKey({ record: inputRecord, rowIndex: 0 });
    const withDifferentAmount = buildImportKey({
      record: { ...inputRecord, Amount: 304 },
      rowIndex: 0,
    });

    expect(original).not.toBe(withDifferentAmount);
  });

  it('treats a missing subcategory as an empty field', () => {
    const { Subcategory: _subcategory, ...withoutSubcategory } = inputRecord;
    const explicitEmpty = buildImportKey({
      record: { ...withoutSubcategory, Subcategory: '' },
      rowIndex: 0,
    });
    const missing = buildImportKey({ record: withoutSubcategory, rowIndex: 0 });

    expect(missing).toBe(explicitEmpty);
  });
});
