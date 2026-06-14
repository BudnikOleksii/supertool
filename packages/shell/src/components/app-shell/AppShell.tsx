import type { FC, PropsWithChildren } from 'react';

import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import { LocaleSwitcher } from '../locale-switcher/LocaleSwitcher';
import { ThemeSwitcher } from '../theme-switcher/ThemeSwitcher';
import { ToolNav } from '../tool-nav/ToolNav';
import { UserMenu } from '../user-menu/UserMenu';
import styles from './AppShell.module.scss';

export interface AppShellProps extends PropsWithChildren {
  tools: ToolRegistryEntry[];
  userName?: string | undefined;
  onSignOut?: (() => void) | undefined;
}

export const AppShell: FC<AppShellProps> = ({ tools, userName, onSignOut, children }) => (
  <div className={styles.shell}>
    <header className={styles.header}>
      <ToolNav tools={tools} />
      <div className={styles.actions}>
        <ThemeSwitcher />
        <LocaleSwitcher />
        <UserMenu userName={userName} onSignOut={onSignOut} />
      </div>
    </header>
    <main className={styles.main}>{children}</main>
  </div>
);
