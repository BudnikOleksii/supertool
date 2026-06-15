import { describe, expect, it } from 'vitest';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';

import { CURRENCY_OPTION_LIST } from './currency-option-list';

describe('CURRENCY_OPTION_LIST', () => {
  it('maps every currency code to a matching value and label', () => {
    expect(CURRENCY_OPTION_LIST).toHaveLength(CURRENCY_CODE_LIST.length);
    expect(CURRENCY_OPTION_LIST.every((option) => option.value === option.label)).toBe(true);
  });

  it('exposes a known currency code as an option', () => {
    expect(CURRENCY_OPTION_LIST).toContainEqual({ value: 'UAH', label: 'UAH' });
  });
});
