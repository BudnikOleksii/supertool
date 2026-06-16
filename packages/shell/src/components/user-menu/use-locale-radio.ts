'use client';

import { useLocale } from 'next-intl';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { checkIsLocaleCode } from '@supertool/shared/constants/locales';

interface LocaleRadio {
  selectedLocale: string;
  onLocaleSelect: (value: string) => Promise<void>;
}

export const useLocaleRadio = (
  onLocaleChange: (locale: LocaleCode) => void | Promise<void>,
): LocaleRadio => {
  const selectedLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onLocaleSelect = async (value: string) => {
    if (!checkIsLocaleCode(value)) {
      return;
    }

    await onLocaleChange(value);
    router.replace(pathname, { locale: value });
  };

  return { selectedLocale, onLocaleSelect };
};
