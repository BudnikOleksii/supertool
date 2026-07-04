const BYTES_PER_KILOBYTE = 1024;
const KILOBYTES_PER_MEGABYTE = 1024;
const KILOBYTE_FRACTION_DIGITS = 0;
const MEGABYTE_FRACTION_DIGITS = 1;

export const formatFileSize = (sizeBytes: number, locale: string): string => {
  const sizeKilobytes = sizeBytes / BYTES_PER_KILOBYTE;

  if (sizeKilobytes < KILOBYTES_PER_MEGABYTE) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'kilobyte',
      maximumFractionDigits: KILOBYTE_FRACTION_DIGITS,
    }).format(sizeKilobytes);
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: MEGABYTE_FRACTION_DIGITS,
  }).format(sizeKilobytes / KILOBYTES_PER_MEGABYTE);
};
