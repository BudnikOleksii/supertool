import { describe, expect, it } from 'vitest';

import { formatFileSize } from './format-file-size';

const KILOBYTE_BYTES = 1024;
const ONE_AND_A_HALF_MEGABYTES_BYTES = 1_572_864;

describe('formatFileSize', () => {
  it('formats sub-megabyte sizes in kilobytes', () => {
    expect(formatFileSize(KILOBYTE_BYTES, 'en')).toBe('1 kB');
  });

  it('formats megabyte sizes with one fraction digit', () => {
    expect(formatFileSize(ONE_AND_A_HALF_MEGABYTES_BYTES, 'en')).toBe('1.5 MB');
  });
});
