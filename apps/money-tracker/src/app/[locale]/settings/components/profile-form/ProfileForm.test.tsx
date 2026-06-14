import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UserResponseDto } from '@supertool/shared/generated/types.gen';

import { ProfileForm } from './ProfileForm';

const { updateProfile } = vi.hoisted(() => ({ updateProfile: vi.fn() }));

vi.mock('../../../../../actions/update-profile', () => ({ updateProfile }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const PROFILE: UserResponseDto = {
  id: 'user-id',
  email: 'ann@example.com',
  name: 'Ann',
  role: 'user',
  locale: 'en',
  defaultCurrency: null,
};

describe('ProfileForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the fields populated from the profile', () => {
    render(<ProfileForm profile={PROFILE} />);

    expect(screen.getByLabelText('nameLabel')).toHaveProperty('value', 'Ann');
    screen.getByRole('button', { name: 'submit' });
  });

  it('shows a validation error and does not submit when the name is empty', async () => {
    updateProfile.mockResolvedValue({ status: 'success' });
    render(<ProfileForm profile={PROFILE} />);

    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await screen.findByText('nameRequired');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('invokes the update action with the form values on a valid submit', async () => {
    updateProfile.mockResolvedValue({ status: 'success' });
    render(<ProfileForm profile={PROFILE} />);

    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'Ann Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ann Updated', locale: 'en' }),
      );
    });
  });

  it('disables the submit button while the action is pending', async () => {
    updateProfile.mockReturnValue(new Promise(() => undefined));
    render(<ProfileForm profile={PROFILE} />);

    const submitButton = screen.getByRole('button', { name: 'submit' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toHaveProperty('disabled', true);
    });
  });
});
