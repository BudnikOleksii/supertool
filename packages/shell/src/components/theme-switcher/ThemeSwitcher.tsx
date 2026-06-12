'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Select } from '@supertool/ui/src/components/select/Select';

import { checkIsThemeOption, THEME_OPTION, THEME_OPTION_LIST } from './constants';
import styles from './ThemeSwitcher.module.scss';

export const ThemeSwitcher: FC = () => {
  const translate = useTranslations('navigation.themeSwitcher');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (value: string) => {
    if (!checkIsThemeOption(value)) {
      return;
    }

    setTheme(value);
  };

  const optionList = THEME_OPTION_LIST.map((themeOption) => ({
    value: themeOption,
    label: translate(themeOption),
  }));

  if (!mounted) {
    return (
      <span className={styles.placeholder}>
        <Select
          value={THEME_OPTION.System}
          onValueChange={handleThemeChange}
          optionList={optionList}
          ariaLabel={translate('label')}
        />
      </span>
    );
  }

  const selectedTheme = theme && checkIsThemeOption(theme) ? theme : THEME_OPTION.System;

  return (
    <Select
      value={selectedTheme}
      onValueChange={handleThemeChange}
      optionList={optionList}
      ariaLabel={translate('label')}
    />
  );
};
