import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SignUpForm } from './SignUpForm';

const EXPECTED_SINGLE_CALL = 1;

const { signUpEmail } = vi.hoisted(() => ({ signUpEmail: vi.fn() }));

vi.mock('../../auth/auth-client', () => ({
  authClient: { signUp: { email: signUpEmail } },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const fillForm = (name: string, email: string, password: string): void => {
  fireEvent.change(screen.getByLabelText('name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('password'), { target: { value: password } });
};

describe('SignUpForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the name, email and password fields and a submit button', () => {
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    screen.getByLabelText('name');
    screen.getByLabelText('email');
    screen.getByLabelText('password');
    screen.getByRole('button', { name: 'Sign up' });
  });

  it('shows a validation error when the name is missing', async () => {
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    fillForm('', 'user@example.com', 'supersecret123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await screen.findByText('nameRequired');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('calls the auth client and onSuccess with valid input', async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    render(<SignUpForm onSuccess={onSuccess} submitLabel="Sign up" />);

    fillForm('Oleksii', 'user@example.com', 'supersecret123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith({
        name: 'Oleksii',
        email: 'user@example.com',
        password: 'supersecret123',
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL);
    });
  });

  it('surfaces a user-already-exists error from the auth client', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: 'USER_ALREADY_EXISTS' } });
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    fillForm('Oleksii', 'user@example.com', 'supersecret123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await screen.findByText('userExists');
  });
});
