import type { NavItem } from '../app-shell/types';

const getLeafItemList = (navItems: NavItem[]): NavItem[] =>
  navItems.flatMap((item) => item.children ?? [item]);

export const getActiveHref = (pathname: string, navItems: NavItem[]): string | undefined =>
  getLeafItemList(navItems)
    .filter((item) => !item.disabled)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .reduce<NavItem | undefined>(
      (longest, item) =>
        longest === undefined || item.href.length > longest.href.length ? item : longest,
      undefined,
    )?.href;

export const checkHasActiveChild = (item: NavItem, activeHref: string | undefined): boolean =>
  activeHref !== undefined && (item.children ?? []).some((child) => child.href === activeHref);
