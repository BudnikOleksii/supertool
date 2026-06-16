import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { noop } from '@supertool/shared/utils/noop';

import { UserMenu } from './UserMenu';

const mockSetTheme = vi.fn();
const mockReplace = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: mockSetTheme }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: mockReplace }),
}));

const TEST_MESSAGES = {
  navigation: {
    userMenu: { settings: 'Settings', signOut: 'Sign out' },
    localeSwitcher: { label: 'Language', en: 'English', uk: 'Українська' },
    themeSwitcher: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  },
};

const renderUserMenu = (onLocaleChange = noop, onOpenSettings = noop, onSignOut = noop) =>
  render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <UserMenu
        userName="Oleksii"
        onLocaleChange={onLocaleChange}
        onOpenSettings={onOpenSettings}
        onSignOut={onSignOut}
      />
    </NextIntlClientProvider>,
  );

const openMenu = () => {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Oleksii' }), { key: 'Enter' });
};

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

describe('UserMenu', () => {
  it('renders the signed-in user name as the menu trigger', () => {
    renderUserMenu();

    expect(screen.getByRole('button', { name: 'Oleksii' })).toHaveProperty('disabled', false);
  });

  it('invokes settings and sign-out callbacks from the menu', () => {
    const onOpenSettings = vi.fn();
    const onSignOut = vi.fn();
    renderUserMenu(noop, onOpenSettings, onSignOut);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(onOpenSettings).toHaveBeenCalled();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('changes the theme from the embedded theme radio group', () => {
    renderUserMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('changes the locale from the embedded language radio group', () => {
    const onLocaleChange = vi.fn();
    renderUserMenu(onLocaleChange);

    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Українська' }));

    expect(onLocaleChange).toHaveBeenCalledWith('uk');
  });
});
