import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SignInForm } from './SignInForm';

const EXPECTED_SINGLE_CALL = 1;

const { signInEmail } = vi.hoisted(() => ({ signInEmail: vi.fn() }));

vi.mock('../../auth/auth-client', () => ({
  authClient: { signIn: { email: signInEmail } },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const fillCredentials = (email: string, password: string): void => {
  fireEvent.change(screen.getByLabelText('email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('password'), { target: { value: password } });
};

describe('SignInForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email and password fields and a submit button', () => {
    render(<SignInForm onSuccess={vi.fn()} submitLabel="Sign in" />);

    screen.getByLabelText('email');
    screen.getByLabelText('password');
    screen.getByRole('button', { name: 'Sign in' });
  });

  it('shows a validation error for an invalid email', async () => {
    render(<SignInForm onSuccess={vi.fn()} submitLabel="Sign in" />);

    fillCredentials('not-an-email', 'supersecret123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText('emailInvalid');
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('calls the auth client and onSuccess with valid credentials', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    render(<SignInForm onSuccess={onSuccess} submitLabel="Sign in" />);

    fillCredentials('user@example.com', 'supersecret123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'supersecret123',
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL);
    });
  });

  it('disables the submit button while the request is pending', async () => {
    signInEmail.mockReturnValue(new Promise(() => undefined));
    render(<SignInForm onSuccess={vi.fn()} submitLabel="Sign in" />);

    fillCredentials('user@example.com', 'supersecret123');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toHaveProperty('disabled', true);
    });
  });

  it('surfaces an invalid-credentials error from the auth client', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    render(<SignInForm onSuccess={vi.fn()} submitLabel="Sign in" />);

    fillCredentials('user@example.com', 'supersecret123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText('invalidCredentials');
  });
});
