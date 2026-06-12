import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeSwitcher } from './ThemeSwitcher';

const { setThemeMock, themeState } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
  themeState: { current: 'light' },
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: themeState.current, setTheme: setThemeMock }),
}));

const TEST_MESSAGES = {
  navigation: {
    themeSwitcher: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  },
};

const renderThemeSwitcher = () => {
  render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <ThemeSwitcher />
    </NextIntlClientProvider>,
  );
};

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
  globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  setThemeMock.mockClear();
  themeState.current = 'light';
});

describe('ThemeSwitcher', () => {
  it('shows the current theme after mount', () => {
    renderThemeSwitcher();

    expect(screen.getByRole('combobox', { name: 'Theme' }).textContent).toContain('Light');
  });

  it('switches the theme through next-themes', () => {
    renderThemeSwitcher();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Theme' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Dark' }));

    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('falls back to the system option when the stored theme is not a known option', () => {
    themeState.current = 'neon';

    renderThemeSwitcher();

    expect(screen.getByRole('combobox', { name: 'Theme' }).textContent).toContain('System');
  });

  it('offers the system preference option', () => {
    renderThemeSwitcher();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Theme' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'System' }));

    expect(setThemeMock).toHaveBeenCalledWith('system');
  });
});
