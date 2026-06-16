'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@supertool/ui/src/components/molecules/dropdown-menu/DropdownMenu';

import { THEME_OPTION_LIST } from '../theme-switcher/constants';
import { useLocaleRadio } from './use-locale-radio';
import { useThemeRadio } from './use-theme-radio';

interface Props {
  userName: string;
  onLocaleChange: (locale: LocaleCode) => void | Promise<void>;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export const UserMenu: FC<Props> = ({ userName, onLocaleChange, onOpenSettings, onSignOut }) => {
  const translate = useTranslations(I18N_NAMESPACE.navigation);
  const { selectedTheme, onThemeChange } = useThemeRadio();
  const { selectedLocale, onLocaleSelect } = useLocaleRadio(onLocaleChange);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">{userName}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{translate('themeSwitcher.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedTheme} onValueChange={onThemeChange}>
          {THEME_OPTION_LIST.map((themeOption) => (
            <DropdownMenuRadioItem key={themeOption} value={themeOption}>
              {translate(`themeSwitcher.${themeOption}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{translate('localeSwitcher.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedLocale} onValueChange={onLocaleSelect}>
          {LOCALE_CODE_LIST.map((localeCode) => (
            <DropdownMenuRadioItem key={localeCode} value={localeCode}>
              {translate(`localeSwitcher.${localeCode}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            onOpenSettings();
          }}
        >
          {translate('userMenu.settings')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onSignOut();
          }}
        >
          {translate('userMenu.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
