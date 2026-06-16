'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { NavigationLink } from '@supertool/next-shared/src/i18n/navigation/NavigationLink';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { cn } from '@supertool/ui/src/lib/utils';

import type { NavItem } from '../app-shell/types';

import { useSidebar } from '../sidebar-provider/SidebarProvider';
import styles from './AppSidebar.module.scss';

interface Props {
  item: NavItem;
  isChild?: boolean;
}

const NAV_ICON_SIZE = 20;

export const SidebarNavLink: FC<Props> = ({ item, isChild = false }) => {
  const labelTranslate = useTranslations(`${I18N_NAMESPACE.navigation}.labels`);
  const { isCollapsed, onCloseMobile } = useSidebar();

  const label = labelTranslate(item.labelKey);
  const className = cn(styles.navItem, isChild && styles.childItem);

  const content = (
    <>
      {item.Icon !== undefined && (
        <span className={styles.navIcon}>
          <item.Icon size={NAV_ICON_SIZE} aria-hidden="true" />
        </span>
      )}
      <span className={styles.navLabel}>{label}</span>
    </>
  );

  if (item.disabled === true) {
    return (
      <span
        className={cn(className, styles.disabled)}
        aria-disabled="true"
        aria-label={isCollapsed ? label : undefined}
        title={isCollapsed ? label : undefined}
      >
        {content}
      </span>
    );
  }

  return (
    <NavigationLink
      href={item.href}
      className={className}
      onClick={onCloseMobile}
      aria-label={isCollapsed ? label : undefined}
      title={isCollapsed ? label : undefined}
    >
      {content}
    </NavigationLink>
  );
};
