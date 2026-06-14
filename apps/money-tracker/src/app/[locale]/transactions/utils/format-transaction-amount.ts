const formatterCache = new Map<string, Intl.NumberFormat>();

const getCurrencyFormatter = (locale: string, currency: string): Intl.NumberFormat => {
  const cacheKey = `${locale}:${currency}`;
  const cachedFormatter = formatterCache.get(cacheKey);

  if (cachedFormatter !== undefined) {
    return cachedFormatter;
  }

  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  formatterCache.set(cacheKey, formatter);

  return formatter;
};

export const formatTransactionAmount = (
  amount: string,
  currency: string,
  locale: string,
): string => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return amount;
  }

  return getCurrencyFormatter(locale, currency).format(numericAmount);
};
