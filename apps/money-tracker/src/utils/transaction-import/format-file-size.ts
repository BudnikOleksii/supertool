const BYTES_PER_KILOBYTE = 1024;
const KILOBYTES_PER_MEGABYTE = 1024;
const WHOLE_UNIT_FRACTION_DIGITS = 0;
const MEGABYTE_FRACTION_DIGITS = 1;

export const formatFileSize = (sizeBytes: number, locale: string): string => {
  if (sizeBytes < BYTES_PER_KILOBYTE) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'byte',
      unitDisplay: 'long',
      maximumFractionDigits: WHOLE_UNIT_FRACTION_DIGITS,
    }).format(sizeBytes);
  }

  const sizeKilobytes = sizeBytes / BYTES_PER_KILOBYTE;

  if (sizeKilobytes < KILOBYTES_PER_MEGABYTE) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'kilobyte',
      maximumFractionDigits: WHOLE_UNIT_FRACTION_DIGITS,
    }).format(sizeKilobytes);
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: MEGABYTE_FRACTION_DIGITS,
  }).format(sizeKilobytes / KILOBYTES_PER_MEGABYTE);
};
