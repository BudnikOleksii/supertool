import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChangePasswordForm } from './ChangePasswordForm';

const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn() }));

vi.mock('../../auth/auth-client', () => ({
  authClient: { changePassword },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const SUBMIT_LABEL = 'changePasswordSubmit';

const fillForm = (currentPassword: string, newPassword: string, confirmPassword: string): void => {
  fireEvent.change(screen.getByLabelText('currentPassword'), {
    target: { value: currentPassword },
  });
  fireEvent.change(screen.getByLabelText('newPassword'), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText('confirmPassword'), {
    target: { value: confirmPassword },
  });
};

describe('ChangePasswordForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the current, new and confirm password fields and a submit button', () => {
    render(<ChangePasswordForm />);

    screen.getByLabelText('currentPassword');
    screen.getByLabelText('newPassword');
    screen.getByLabelText('confirmPassword');
    screen.getByRole('button', { name: SUBMIT_LABEL });
  });

  it('blocks submission and shows a min-length error for a short new password', async () => {
    render(<ChangePasswordForm />);

    fillForm('supersecret123', 'short', 'short');
    fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

    await screen.findByText('passwordMinLength');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a mismatch error when confirm differs from new', async () => {
    render(<ChangePasswordForm />);

    fillForm('supersecret123', 'brandnewpass456', 'brandnewpass999');
    fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

    await screen.findByText('passwordsMismatch');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('calls the auth client with the current and new password on a valid submit', async () => {
    changePassword.mockResolvedValue({ data: {}, error: null });
    render(<ChangePasswordForm />);

    fillForm('supersecret123', 'brandnewpass456', 'brandnewpass456');
    fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'supersecret123',
        newPassword: 'brandnewpass456',
      });
    });
  });

  it('shows the success confirmation and resets the fields after a successful change', async () => {
    changePassword.mockResolvedValue({ data: {}, error: null });
    render(<ChangePasswordForm />);

    fillForm('supersecret123', 'brandnewpass456', 'brandnewpass456');
    fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

    await screen.findByText('passwordChangeSuccess');
    await waitFor(() => {
      expect(screen.getByLabelText('currentPassword')).toHaveProperty('value', '');
    });
    expect(screen.getByLabelText('newPassword')).toHaveProperty('value', '');
    expect(screen.getByLabelText('confirmPassword')).toHaveProperty('value', '');
  });

  it('maps a wrong current password to the localized invalidCurrentPassword message', async () => {
    changePassword.mockResolvedValue({ data: null, error: { code: 'INVALID_PASSWORD' } });
    render(<ChangePasswordForm />);

    fillForm('wrongcurrent123', 'brandnewpass456', 'brandnewpass456');
    fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

    await screen.findByText('invalidCurrentPassword');
  });

  it('disables the submit button while the request is pending', async () => {
    changePassword.mockReturnValue(new Promise(() => undefined));
    render(<ChangePasswordForm />);

    fillForm('supersecret123', 'brandnewpass456', 'brandnewpass456');
    const submitButton = screen.getByRole('button', { name: SUBMIT_LABEL });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toHaveProperty('disabled', true);
    });
  });
});
