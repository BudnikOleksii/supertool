import deepmerge from 'deepmerge';

import type { LocaleCode } from '@supertool/shared/constants/locales';
import { DEFAULT_LOCALE } from '@supertool/shared/constants/locales';
import type { LocalizationMessages } from '@supertool/shared/types/localization-messages';
import { withCache } from '@supertool/shared/utils/with-cache';

import { LOCALIZATION_MESSAGES_FILE_NAME_BY_NAMESPACE } from '../constants/localization-messages-file-name-by-namespace';

const importMessagesJson = async (locale: LocaleCode, fileName: string): Promise<unknown> => {
  const messagesModule = await import(`../../../messages/${locale}/${fileName}.json`);

  return messagesModule.default;
};

const getMessagesByLocaleInternal = async (
  locale: LocaleCode,
  fileByNamespace: Record<string, string>,
): Promise<LocalizationMessages> => {
  const messages: LocalizationMessages = {};
  const namespaceEntries = Object.entries(fileByNamespace);

  const loadMessageList = namespaceEntries.map(async ([namespace, fileName]) => {
    if (!fileName) {
      return;
    }

    try {
      const localizedMessages = await importMessagesJson(locale, fileName);

      messages[namespace] = localizedMessages;
    } catch {
      const defaultMessages = await importMessagesJson(DEFAULT_LOCALE, fileName);

      messages[namespace] = defaultMessages;
    }
  });

  await Promise.all(loadMessageList);

  return messages;
};

const getBundledMessagesByLocale = async (locale: LocaleCode): Promise<LocalizationMessages> => {
  const currentLocaleMessages = await getMessagesByLocaleInternal(
    locale,
    LOCALIZATION_MESSAGES_FILE_NAME_BY_NAMESPACE,
  );

  const defaultLocaleMessages = await getMessagesByLocaleInternal(
    DEFAULT_LOCALE,
    LOCALIZATION_MESSAGES_FILE_NAME_BY_NAMESPACE,
  );

  return deepmerge(defaultLocaleMessages, currentLocaleMessages);
};

export const getMessagesByLocale = withCache(getBundledMessagesByLocale);
