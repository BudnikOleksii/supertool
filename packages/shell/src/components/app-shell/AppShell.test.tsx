import type { AnchorHTMLAttributes } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';
import { noop } from '@supertool/shared/utils/noop';

import type { NavItem } from './types';

import { AppShell } from './AppShell';

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  redirect: vi.fn(),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}));

const TEST_MESSAGES = {
  navigation: {
    label: 'Tools',
    primaryNav: 'Primary navigation',
    labels: { dashboard: 'Dashboard', transactions: 'Transactions' },
    actions: { openMenu: 'Open menu', expand: 'Expand sidebar', collapse: 'Collapse sidebar' },
    tools: { moneyTracker: 'Money Tracker', reportHub: 'Report Hub' },
    userMenu: { settings: 'Settings', signOut: 'Sign out' },
    localeSwitcher: { label: 'Language', en: 'English', uk: 'Українська' },
    themeSwitcher: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  },
};

const TOOL_FIXTURE_LIST: ToolRegistryEntry[] = [
  { id: 'money-tracker', nameKey: 'navigation.tools.moneyTracker', path: '/' },
];

const NAV_ITEM_FIXTURE_LIST: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', Icon: Circle },
  { href: '/transactions', labelKey: 'transactions', Icon: Circle },
];

const SHELL_CHILDREN = <p>Tool content</p>;

const queryBackdrop = () => document.querySelector('div[aria-hidden="true"]');

const openDrawer = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
};

const renderAppShell = (userName?: string, navItems: NavItem[] = NAV_ITEM_FIXTURE_LIST) => {
  render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <AppShell
        tools={TOOL_FIXTURE_LIST}
        navItems={navItems}
        userName={userName}
        onLocaleChange={noop}
        onOpenSettings={noop}
        onSignOut={noop}
      >
        {SHELL_CHILDREN}
      </AppShell>
    </NextIntlClientProvider>,
  );
};

describe('AppShell', () => {
  it('renders the sidebar shell for a signed-in user', () => {
    renderAppShell('Oleksii');

    expect(screen.getByRole('link', { name: 'Money Tracker' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Oleksii' })).toBeDefined();
  });

  it('renders the chrome-light header (with switchers) when signed out', () => {
    renderAppShell();

    expect(screen.getByRole('link', { name: 'Money Tracker' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Theme' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeDefined();
  });

  it('omits the sidebar, hamburger and user menu when signed out', () => {
    renderAppShell();

    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Oleksii' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('renders children inside the main landmark', () => {
    renderAppShell('Oleksii');

    expect(screen.getByRole('main').textContent).toBe('Tool content');
  });

  it('opens the mobile drawer with a backdrop from the hamburger', () => {
    renderAppShell('Oleksii');

    expect(queryBackdrop()).toBeNull();
    openDrawer();

    expect(queryBackdrop()).not.toBeNull();
  });

  it('closes the mobile drawer when the backdrop is clicked', () => {
    renderAppShell('Oleksii');

    openDrawer();
    const backdrop = queryBackdrop();

    if (backdrop === null) {
      throw new Error('Drawer backdrop not found');
    }

    fireEvent.click(backdrop);

    expect(queryBackdrop()).toBeNull();
  });

  it('closes the mobile drawer on Escape', () => {
    renderAppShell('Oleksii');

    openDrawer();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(queryBackdrop()).toBeNull();
  });

  it('closes the mobile drawer when a destination is selected', () => {
    renderAppShell('Oleksii');

    openDrawer();
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));

    expect(queryBackdrop()).toBeNull();
  });

  it('exposes the open mobile drawer as a modal dialog and locks body scroll', () => {
    renderAppShell('Oleksii');

    openDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Primary navigation' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when the mobile drawer closes', () => {
    renderAppShell('Oleksii');

    openDrawer();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.body.style.overflow).toBe('');
  });
});
