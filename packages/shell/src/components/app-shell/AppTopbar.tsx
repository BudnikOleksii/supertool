'use client';

import type { FC } from 'react';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';

import { useSidebar } from '../sidebar-provider/SidebarProvider';
import { UserMenu } from '../user-menu/UserMenu';
import styles from './AppTopbar.module.scss';

interface Props {
  userName: string;
  onLocaleChange: (locale: LocaleCode) => void | Promise<void>;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

const MENU_ICON_SIZE = 20;

export const AppTopbar: FC<Props> = ({ userName, onLocaleChange, onOpenSettings, onSignOut }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.navigation}.actions`);
  const { onToggleMobile } = useSidebar();

  return (
    <header className={styles.topbar}>
      <Button
        variant="ghost"
        size="icon"
        className={styles.menuButton}
        aria-label={translate('openMenu')}
        onClick={onToggleMobile}
      >
        <Menu size={MENU_ICON_SIZE} aria-hidden="true" />
      </Button>
      <div className={styles.actions}>
        <UserMenu
          userName={userName}
          onLocaleChange={onLocaleChange}
          onOpenSettings={onOpenSettings}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
};
