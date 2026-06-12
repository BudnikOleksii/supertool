import type { FC, PropsWithChildren } from 'react';

import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import { LocaleSwitcher } from '../locale-switcher/LocaleSwitcher';
import { ToolNav } from '../tool-nav/ToolNav';
import { UserMenu } from '../user-menu/UserMenu';
import styles from './AppShell.module.scss';

export interface AppShellProps extends PropsWithChildren {
  tools: ToolRegistryEntry[];
}

export const AppShell: FC<AppShellProps> = ({ tools, children }) => (
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
