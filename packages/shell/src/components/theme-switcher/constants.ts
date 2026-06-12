import type { ObjectValuesUnion } from '@supertool/shared/types/object-values-union';

export const THEME_OPTION = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const;

export const THEME_OPTION_LIST = Object.values(THEME_OPTION);

export type ThemeOption = ObjectValuesUnion<typeof THEME_OPTION>;

export const checkIsThemeOption = (value: string): value is ThemeOption =>
  THEME_OPTION_LIST.some((themeOption) => themeOption === value);
