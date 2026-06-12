import type { IntlError } from 'next-intl';

export const getTranslationMessageFallback = ({ key }: { key: string; error: IntlError }): string =>
  key;
