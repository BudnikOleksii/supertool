import { useEffect, useMemo, useState } from 'react';

import type { NavItem } from '../app-shell/types';

import { checkHasActiveChild } from './nav-active-state';

interface ActiveSubmenu {
  openHrefList: string[];
  onToggleSubmenu: (href: string) => void;
}

export const useActiveSubmenu = (
  navItems: NavItem[],
  activeHref: string | undefined,
): ActiveSubmenu => {
  const activeParentHrefList = useMemo(
    () => navItems.filter((item) => checkHasActiveChild(item, activeHref)).map((item) => item.href),
    [navItems, activeHref],
  );

  const [openHrefList, setOpenHrefList] = useState<string[]>(activeParentHrefList);

  useEffect(() => {
    setOpenHrefList((previous) => {
      const merged = new Set([...previous, ...activeParentHrefList]);

      return merged.size === previous.length ? previous : [...merged];
    });
  }, [activeParentHrefList]);

  const onToggleSubmenu = (href: string) => {
    setOpenHrefList((previous) =>
      previous.includes(href) ? previous.filter((item) => item !== href) : [...previous, href],
    );
  };

  return { openHrefList, onToggleSubmenu };
};
