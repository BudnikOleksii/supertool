import type { AnchorHTMLAttributes } from 'react';

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import { AppShell } from './AppShell';

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  redirect: vi.fn(),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

const TEST_MESSAGES = {
  navigation: {
    label: 'Tools',
    tools: { moneyTracker: 'Money Tracker', reportHub: 'Report Hub' },
    userMenu: { label: 'Account' },
    localeSwitcher: { label: 'Language', en: 'English', uk: 'Українська' },
  },
};

const TOOL_FIXTURE_LIST: ToolRegistryEntry[] = [
  { id: 'money-tracker', nameKey: 'navigation.tools.moneyTracker', path: '/' },
  { id: 'report-hub', nameKey: 'navigation.tools.reportHub', path: '/report-hub' },
];

const SHELL_CHILDREN = <p>Tool content</p>;

const renderAppShell = () => {
  render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <AppShell tools={TOOL_FIXTURE_LIST}>{SHELL_CHILDREN}</AppShell>
    </NextIntlClientProvider>,
  );
};

describe('AppShell', () => {
  it('renders a navigation item for every registry entry without shell changes', () => {
    renderAppShell();

    expect(screen.getByRole('link', { name: 'Money Tracker' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Report Hub' })).toBeDefined();
  });

  it('renders the user menu placeholder and the locale switcher', () => {
    renderAppShell();

    expect(screen.getByRole('button', { name: 'Account' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeDefined();
  });

  it('renders children inside the main landmark', () => {
    renderAppShell();

    expect(screen.getByRole('main').textContent).toBe('Tool content');
  });
});
