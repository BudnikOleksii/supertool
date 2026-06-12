import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeSwitcher } from './ThemeSwitcher';

const { setThemeMock } = vi.hoisted(() => ({ setThemeMock: vi.fn() }));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: setThemeMock }),
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

  it('offers the system preference option', () => {
    renderThemeSwitcher();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Theme' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'System' }));

    expect(setThemeMock).toHaveBeenCalledWith('system');
  });
});
