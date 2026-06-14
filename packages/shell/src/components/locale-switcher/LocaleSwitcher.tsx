'use client';

import type { FC } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { checkIsLocaleCode, LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';

interface Props {
  onLocaleChange: (locale: LocaleCode) => void | Promise<void>;
}

export const LocaleSwitcher: FC<Props> = ({ onLocaleChange }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.navigation}.localeSwitcher`);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = async (value: string) => {
    if (!checkIsLocaleCode(value)) {
      return;
    }

    await onLocaleChange(value);
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
