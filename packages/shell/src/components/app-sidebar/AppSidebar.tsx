'use client';

import type { FC } from 'react';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef } from 'react';

import { usePathname } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { cn } from '@supertool/ui/src/lib/utils';

import type { NavItem } from '../app-shell/types';

import { useDrawerEscapeClose } from '../app-shell/use-drawer-escape-close';
import { useDrawerModal } from '../app-shell/use-drawer-modal';
import { useSidebar } from '../sidebar-provider/SidebarProvider';
import { ToolNav } from '../tool-nav/ToolNav';
import styles from './AppSidebar.module.scss';
import { checkHasActiveChild, getActiveHref } from './nav-active-state';
import { SidebarNavLink } from './SidebarNavLink';
import { useActiveSubmenu } from './use-active-submenu';

interface Props {
  tools: ToolRegistryEntry[];
  navItems: NavItem[];
}

const NAV_ICON_SIZE = 20;
const CHEVRON_SIZE = 16;
const COLLAPSE_ICON_SIZE = 18;
const EMPTY_LIST_LENGTH = 0;
const DRAWER_TAB_INDEX = -1;

export const AppSidebar: FC<Props> = ({ tools, navItems }) => {
  const translate = useTranslations(I18N_NAMESPACE.navigation);
  const labelTranslate = useTranslations(`${I18N_NAMESPACE.navigation}.labels`);
  const { isCollapsed, isMobileOpen, onToggleCollapse, onCloseMobile } = useSidebar();
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  const activeHref = useMemo(() => getActiveHref(pathname, navItems), [pathname, navItems]);
  const { openHrefList, onToggleSubmenu } = useActiveSubmenu(navItems, activeHref);

  useDrawerEscapeClose(isMobileOpen, onCloseMobile);
  useDrawerModal(isMobileOpen, sidebarRef);

  return (
    <>
      {isMobileOpen && (
        <div className={styles.backdrop} aria-hidden="true" onClick={onCloseMobile} />
      )}

      <aside
        ref={sidebarRef}
        className={cn(
          styles.sidebar,
          isCollapsed && styles.collapsed,
          isMobileOpen && styles.mobileOpen,
        )}
        role={isMobileOpen ? 'dialog' : undefined}
        aria-modal={isMobileOpen || undefined}
        aria-label={isMobileOpen ? translate('primaryNav') : undefined}
        tabIndex={isMobileOpen ? DRAWER_TAB_INDEX : undefined}
      >
        <div className={styles.brand}>
          <ToolNav tools={tools} />
        </div>

        <nav className={styles.nav} aria-label={translate('primaryNav')}>
          {navItems.map((item) => {
            const children = item.children ?? [];

            if (children.length > EMPTY_LIST_LENGTH) {
              const isOpen = openHrefList.includes(item.href);
              const hasActiveChild = checkHasActiveChild(item, activeHref);

              return (
                <div key={item.href} className={styles.group}>
                  <button
                    type="button"
                    className={cn(styles.navItem, hasActiveChild && styles.parentActive)}
                    aria-expanded={isOpen}
                    aria-label={isCollapsed ? labelTranslate(item.labelKey) : undefined}
                    title={isCollapsed ? labelTranslate(item.labelKey) : undefined}
                    onClick={() => {
                      onToggleSubmenu(item.href);
                    }}
                  >
                    {item.Icon !== undefined && (
                      <span className={styles.navIcon}>
                        <item.Icon size={NAV_ICON_SIZE} aria-hidden="true" />
                      </span>
                    )}
                    <span className={styles.navLabel}>{labelTranslate(item.labelKey)}</span>
                    <ChevronDown
                      size={CHEVRON_SIZE}
                      className={cn(styles.chevron, isOpen && styles.chevronOpen)}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className={styles.submenu}>
                      {children.map((child) => (
                        <SidebarNavLink key={child.href} item={child} isChild />
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return <SidebarNavLink key={item.href} item={item} />;
          })}
        </nav>

        <div className={styles.footer}>
          <Button
            variant="ghost"
            size="icon"
            className={styles.collapseButton}
            aria-label={isCollapsed ? translate('actions.expand') : translate('actions.collapse')}
            onClick={onToggleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight size={COLLAPSE_ICON_SIZE} aria-hidden="true" />
            ) : (
              <ChevronLeft size={COLLAPSE_ICON_SIZE} aria-hidden="true" />
            )}
          </Button>
        </div>
      </aside>
    </>
  );
};
