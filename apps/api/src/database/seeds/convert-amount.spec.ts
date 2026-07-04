import { describe, expect, it } from 'vitest';

import { convertAmountToString } from './convert-amount';

const INTEGER_AMOUNT = 10;
const TWO_DECIMAL_AMOUNT = 1588.29;
const SINGLE_DECIMAL_AMOUNT = 303.5;
const ARBITRARY_AMOUNT = 42;

describe('convertAmountToString', () => {
  it('renders an integer amount with two decimal places', () => {
    expect(convertAmountToString(INTEGER_AMOUNT)).toBe('10.00');
  });

  it('preserves a two-decimal amount exactly', () => {
    expect(convertAmountToString(TWO_DECIMAL_AMOUNT)).toBe('1588.29');
  });

  it('renders a single-decimal amount padded to two places', () => {
    expect(convertAmountToString(SINGLE_DECIMAL_AMOUNT)).toBe('303.50');
  });

  it('returns a string, never a float', () => {
    expect(typeof convertAmountToString(ARBITRARY_AMOUNT)).toBe('string');
  });

  it('converts a two-decimal string amount exactly', () => {
    expect(convertAmountToString('1588.29')).toBe('1588.29');
  });

  it('resolves a three-decimal string amount via Decimal half-up rounding, never float math', () => {
    expect(convertAmountToString('10.005')).toBe('10.01');
  });

  it('pads an integer string amount to two decimal places', () => {
    expect(convertAmountToString('42')).toBe('42.00');
  });

  it('throws on a non-numeric string amount', () => {
    expect(() => convertAmountToString('abc')).toThrow();
  });

  it('renders a literal NaN string as NaN rather than throwing', () => {
    expect(convertAmountToString('NaN')).toBe('NaN');
  });
});
