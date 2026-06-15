const FRACTION_START_INDEX = 0;
const FRACTION_DIGITS = 2;
const FRACTION_PAD_CHAR = '0';
const DEFAULT_INTEGER_PART = '0';
const LEADING_ZEROS_PATTERN = /^0+(?=\d)/u;

export const normalizeAmount = (value: string): string => {
  const [integerPart = DEFAULT_INTEGER_PART, fractionPart = ''] = value.trim().split('.');
  const normalizedInteger = integerPart.replace(LEADING_ZEROS_PATTERN, '');
  const normalizedFraction = fractionPart
    .slice(FRACTION_START_INDEX, FRACTION_DIGITS)
    .padEnd(FRACTION_DIGITS, FRACTION_PAD_CHAR);

  return `${normalizedInteger}.${normalizedFraction}`;
};
