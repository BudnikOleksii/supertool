import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from './UserMenu';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

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
});
