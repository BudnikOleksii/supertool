'use client';

import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';
import { Select } from '@supertool/ui/src/components/select/select';

const checkIsLocaleCode = (value: string): value is LocaleCode =>
  LOCALE_CODE_LIST.some((localeCode) => localeCode === value);

export const LocaleSwitcher = () => {
  const translate = useTranslations('shell.localeSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (value: string) => {
    if (!checkIsLocaleCode(value)) {
      return;
    }

    router.replace(pathname, { locale: value });
  };

  const optionList = LOCALE_CODE_LIST.map((localeCode) => ({
    value: localeCode,
    label: translate(localeCode),
  }));

  return (
    <Select
      value={locale}
      onValueChange={handleLocaleChange}
      optionList={optionList}
      ariaLabel={translate('label')}
    />
  );
};
