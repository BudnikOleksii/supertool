import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';

export const routing = defineRouting({
  locales: LOCALE_CODE_LIST,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
});
