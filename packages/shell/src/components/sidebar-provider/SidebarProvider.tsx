'use client';

import type { FC, PropsWithChildren } from 'react';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

interface SidebarContextValue {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const useSidebar = (): SidebarContextValue => {
  const context = useContext(SidebarContext);

  if (context === null) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }

  return context;
};

export const SidebarProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') {
      return;
    }

    const desktopQuery = globalThis.matchMedia(DESKTOP_MEDIA_QUERY);

    const closeOnDesktop = () => {
      if (desktopQuery.matches) {
        setIsMobileOpen(false);
      }
    };

    closeOnDesktop();
    desktopQuery.addEventListener('change', closeOnDesktop);

    return () => {
      desktopQuery.removeEventListener('change', closeOnDesktop);
    };
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((previous) => !previous);
  }, []);

  const handleToggleMobile = useCallback(() => {
    setIsMobileOpen((previous) => !previous);
  }, []);

  const handleCloseMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const value = useMemo<SidebarContextValue>(
    () => ({
      isCollapsed,
      isMobileOpen,
      onToggleCollapse: handleToggleCollapse,
      onToggleMobile: handleToggleMobile,
      onCloseMobile: handleCloseMobile,
    }),
    [isCollapsed, isMobileOpen, handleToggleCollapse, handleToggleMobile, handleCloseMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};
