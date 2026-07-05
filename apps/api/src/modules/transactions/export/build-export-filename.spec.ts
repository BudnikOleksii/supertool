import { describe, expect, it } from 'vitest';

import { buildExportFilename } from './build-export-filename';

const FIXED_TODAY = '2026-07-05';

describe('buildExportFilename', () => {
  it('uses the current date when no period range is active', () => {
    expect(buildExportFilename('csv', {}, FIXED_TODAY)).toBe('transactions-2026-07-05.csv');
  });

  it('uses the date range when both bounds are present', () => {
    expect(
      buildExportFilename('json', { dateFrom: '2025-02-01', dateTo: '2025-02-28' }, FIXED_TODAY),
    ).toBe('transactions-2025-02-01_2025-02-28.json');
  });

  it('falls back to the current date when only one bound is present', () => {
    expect(buildExportFilename('csv', { dateFrom: '2025-02-01' }, FIXED_TODAY)).toBe(
      'transactions-2026-07-05.csv',
    );
  });

  it('uses the format value as the file extension', () => {
    expect(buildExportFilename('json', {}, FIXED_TODAY).endsWith('.json')).toBe(true);
  });
});
