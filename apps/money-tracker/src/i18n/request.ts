import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from '@supertool/next-shared/src/i18n/routing';
import type { LocaleCode } from '@supertool/shared/constants/locales';

const resolveLocale = (requestedLocale: string | undefined): LocaleCode => {
  if (hasLocale(routing.locales, requestedLocale)) {
    return requestedLocale;
  }

  return routing.defaultLocale;
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);
  const messagesModule = await import(`../../messages/${locale}.json`);

  return {
    locale,
    messages: messagesModule.default,
  };
});
