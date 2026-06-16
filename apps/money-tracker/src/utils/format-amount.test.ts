import { describe, expect, it } from 'vitest';

import { formatAmount } from './format-amount';

describe('formatAmount', () => {
  it('formats a string amount as localized currency without losing the decimal value', () => {
    const actual = formatAmount('1234.56', 'USD', 'en');

    expect(actual).toBe('$1,234.56');
  });

  it('keeps two decimal places for whole-number string amounts', () => {
    const actual = formatAmount('1000.00', 'USD', 'en');

    expect(actual).toBe('$1,000.00');
  });

  it('formats UAH amounts in the Ukrainian locale with the hryvnia symbol and comma decimals', () => {
    const actual = formatAmount('1234.56', 'UAH', 'uk');

    expect(actual).toContain('234,56');
    expect(actual).toContain('₴');
  });

  it('returns the raw amount when the value is not a finite number', () => {
    const actual = formatAmount('not-a-number', 'USD', 'en');

    expect(actual).toBe('not-a-number');
  });
});
