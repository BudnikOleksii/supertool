import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { getTranslationMessageFallback } from '@supertool/next-shared/src/i18n/utils/get-translation-message-fallback';
import { onTranslateError } from '@supertool/next-shared/src/i18n/utils/on-translate-error';
import { checkIsLocaleCode } from '@supertool/shared/constants/locales';

import { getMessagesByLocale } from './utils/get-messages-by-locale';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!locale || !checkIsLocaleCode(locale)) {
    return notFound();
  }

  return {
    getMessageFallback: getTranslationMessageFallback,
    locale,
    messages: await getMessagesByLocale(locale),
    onError: onTranslateError,
  };
});
