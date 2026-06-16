import type { FC, PropsWithChildren } from 'react';

import type { LocaleCode } from '@supertool/shared/constants/locales';
import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import type { NavItem } from './types';

import { AppSidebar } from '../app-sidebar/AppSidebar';
import { LocaleSwitcher } from '../locale-switcher/LocaleSwitcher';
import { SidebarProvider } from '../sidebar-provider/SidebarProvider';
import { ThemeSwitcher } from '../theme-switcher/ThemeSwitcher';
import { ToolNav } from '../tool-nav/ToolNav';
import styles from './AppShell.module.scss';
import { AppTopbar } from './AppTopbar';

const EMPTY_NAV_ITEM_LIST: NavItem[] = [];

export interface AppShellProps extends PropsWithChildren {
  tools: ToolRegistryEntry[];
  navItems?: NavItem[];
  userName?: string | undefined;
  onLocaleChange: (locale: LocaleCode) => void | Promise<void>;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export const AppShell: FC<AppShellProps> = ({
  tools,
  navItems = EMPTY_NAV_ITEM_LIST,
  userName,
  onLocaleChange,
  onOpenSettings,
  onSignOut,
  children,
}) => {
  if (userName === undefined) {
    return (
      <div className={styles.shell}>
        <header className={styles.plainHeader}>
          <ToolNav tools={tools} />
          <div className={styles.plainActions}>
            <ThemeSwitcher />
            <LocaleSwitcher onLocaleChange={onLocaleChange} />
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className={styles.appLayout}>
        <AppSidebar tools={tools} navItems={navItems} />
        <div className={styles.content}>
          <AppTopbar
            userName={userName}
            onLocaleChange={onLocaleChange}
            onOpenSettings={onOpenSettings}
            onSignOut={onSignOut}
          />
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};
