'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@supertool/ui/src/components/molecules/dropdown-menu/DropdownMenu';

interface Props {
  userName?: string | undefined;
  onOpenSettings?: (() => void) | undefined;
  onSignOut?: (() => void) | undefined;
}

export const UserMenu: FC<Props> = ({ userName, onOpenSettings, onSignOut }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.navigation}.userMenu`);

  if (userName === undefined) {
    return (
      <Button variant="ghost" disabled>
        {translate('label')}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">{userName}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            onOpenSettings?.();
          }}
        >
          {translate('settings')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onSignOut?.();
          }}
        >
          {translate('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
