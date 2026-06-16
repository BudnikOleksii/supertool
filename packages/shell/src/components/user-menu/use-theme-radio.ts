'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import type { ThemeOption } from '../theme-switcher/constants';

import { checkIsThemeOption, THEME_OPTION } from '../theme-switcher/constants';

interface ThemeRadio {
  selectedTheme: ThemeOption;
  onThemeChange: (value: string) => void;
}

export const useThemeRadio = (): ThemeRadio => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onThemeChange = (value: string) => {
    if (!checkIsThemeOption(value)) {
      return;
    }

    setTheme(value);
  };

  const selectedTheme =
    mounted && theme !== undefined && checkIsThemeOption(theme) ? theme : THEME_OPTION.System;

  return { selectedTheme, onThemeChange };
};
