import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { UserMenu } from './UserMenu';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

describe('UserMenu', () => {
  it('renders a disabled placeholder when there is no signed-in user', () => {
    render(<UserMenu />);

    expect(screen.getByRole('button', { name: 'label' })).toHaveProperty('disabled', true);
  });

  it('renders the signed-in user name as the menu trigger', () => {
    render(<UserMenu userName="Oleksii" onSignOut={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Oleksii' });

    expect(trigger).toHaveProperty('disabled', false);
  });

  it('exposes settings and sign-out items that invoke their callbacks', () => {
    const onOpenSettings = vi.fn();
    const onSignOut = vi.fn();
    render(<UserMenu userName="Oleksii" onOpenSettings={onOpenSettings} onSignOut={onSignOut} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Oleksii' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'settings' }));

    expect(onOpenSettings).toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Oleksii' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'signOut' }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
