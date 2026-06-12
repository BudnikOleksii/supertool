import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { LocaleSwitcher } from './LocaleSwitcher';

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: replaceMock }),
}));

const TEST_MESSAGES = {
  shell: {
    localeSwitcher: { label: 'Language', en: 'English', uk: 'Українська' },
  },
};

const renderLocaleSwitcher = () => {
  render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
};

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
  globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('LocaleSwitcher', () => {
  it('shows the current locale', () => {
    renderLocaleSwitcher();

    expect(screen.getByRole('combobox', { name: 'Language' }).textContent).toContain('English');
  });

  it('switches the locale through router.replace', () => {
    renderLocaleSwitcher();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Language' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Українська' }));

    expect(replaceMock).toHaveBeenCalledWith('/', { locale: 'uk' });
  });
});
