import type { AnchorHTMLAttributes } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import type { NavItem } from '../app-shell/types';

import { SidebarProvider } from '../sidebar-provider/SidebarProvider';
import { AppSidebar } from './AppSidebar';

let mockPathname = '/';

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  usePathname: () => mockPathname,
}));

const TEST_MESSAGES = {
  navigation: {
    label: 'Tools',
    primaryNav: 'Primary navigation',
    labels: {
      dashboard: 'Dashboard',
      transactions: 'Transactions',
      transactionsByDate: 'By date',
      transactionsByCategory: 'By category',
      categories: 'Categories',
    },
    actions: { expand: 'Expand sidebar', collapse: 'Collapse sidebar' },
    tools: { moneyTracker: 'Money Tracker' },
  },
};

const TOOL_FIXTURE_LIST: ToolRegistryEntry[] = [
  { id: 'money-tracker', nameKey: 'navigation.tools.moneyTracker', path: '/' },
];

const NAV_ITEM_FIXTURE_LIST: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', Icon: Circle },
  {
    href: '/transactions',
    labelKey: 'transactions',
    Icon: Circle,
    children: [
      { href: '/transactions', labelKey: 'transactionsByDate', Icon: Circle },
      {
        href: '/transactions/by-category',
        labelKey: 'transactionsByCategory',
        Icon: Circle,
        disabled: true,
      },
    ],
  },
  { href: '/categories', labelKey: 'categories', Icon: Circle },
];

const buildSidebarTree = () => (
  <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
    <SidebarProvider>
      <AppSidebar tools={TOOL_FIXTURE_LIST} navItems={NAV_ITEM_FIXTURE_LIST} />
    </SidebarProvider>
  </NextIntlClientProvider>
);

const renderSidebar = () => render(buildSidebarTree());

afterEach(() => {
  mockPathname = '/';
});

describe('AppSidebar', () => {
  it('renders leaf destinations as links and parents as expandable toggles', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Categories' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Transactions' })).toBeDefined();
  });

  it('keeps the submenu collapsed until the parent is toggled', () => {
    renderSidebar();

    expect(screen.queryByRole('link', { name: 'By date' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Transactions' }));

    expect(screen.getByRole('link', { name: 'By date' })).toBeDefined();
  });

  it('renders disabled children as non-interactive placeholders, not links', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Transactions' }));

    expect(screen.queryByRole('link', { name: 'By category' })).toBeNull();
    expect(screen.getByText('By category').closest('[aria-disabled="true"]')).not.toBeNull();
  });

  it('marks the active destination with aria-current', () => {
    mockPathname = '/dashboard';
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Dashboard', current: 'page' })).toBeDefined();
  });

  it('opens the parent submenu by default when one of its children is active', () => {
    mockPathname = '/transactions';
    renderSidebar();

    expect(screen.getByRole('link', { name: 'By date', current: 'page' })).toBeDefined();
  });

  it('auto-opens the active parent submenu after client navigation while mounted', () => {
    mockPathname = '/dashboard';
    const { rerender } = renderSidebar();

    expect(screen.queryByRole('link', { name: 'By date' })).toBeNull();

    mockPathname = '/transactions';
    rerender(buildSidebarTree());

    expect(screen.getByRole('link', { name: 'By date', current: 'page' })).toBeDefined();
  });

  it('collapses to an icon rail, keeping accessible names via aria-label', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();
  });
});
