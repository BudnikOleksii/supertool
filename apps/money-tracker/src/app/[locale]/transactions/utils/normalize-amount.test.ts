import { describe, expect, it } from 'vitest';

import { normalizeAmount } from './normalize-amount';

describe('normalizeAmount', () => {
  it('pads an integer amount to two decimals', () => {
    expect(normalizeAmount('12')).toBe('12.00');
  });

  it('pads a single-decimal amount to two decimals', () => {
    expect(normalizeAmount('12.5')).toBe('12.50');
  });

  it('keeps an already two-decimal amount unchanged', () => {
    expect(normalizeAmount('12.50')).toBe('12.50');
  });

  it('strips leading zeros from the integer part', () => {
    expect(normalizeAmount('012.30')).toBe('12.30');
  });

  it('trims surrounding whitespace before normalizing', () => {
    expect(normalizeAmount('  7.1  ')).toBe('7.10');
  });
});
