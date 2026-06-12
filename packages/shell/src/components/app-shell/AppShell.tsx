import type { ReactNode } from 'react';

import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import { LocaleSwitcher } from '../locale-switcher/LocaleSwitcher';
import { ToolNav } from '../tool-nav/ToolNav';
import { UserMenu } from '../user-menu/UserMenu';
import styles from './AppShell.module.scss';

export interface AppShellProps {
  tools: ToolRegistryEntry[];
  children: ReactNode;
}

export const AppShell = ({ tools, children }: AppShellProps) => (
  <div className={styles.shell}>
    <header className={styles.header}>
      <ToolNav tools={tools} />
      <div className={styles.actions}>
        <LocaleSwitcher />
        <UserMenu />
      </div>
    </header>
    <main className={styles.main}>{children}</main>
  </div>
);
