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

interface FormInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

const fillForm = ({ firstName, lastName, email, password }: FormInput): void => {
  fireEvent.change(screen.getByLabelText('firstName'), { target: { value: firstName } });
  fireEvent.change(screen.getByLabelText('lastName'), { target: { value: lastName } });
  fireEvent.change(screen.getByLabelText('email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('password'), { target: { value: password } });
};

describe('SignUpForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the first name, last name, email and password fields and a submit button', () => {
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    screen.getByLabelText('firstName');
    screen.getByLabelText('lastName');
    screen.getByLabelText('email');
    screen.getByLabelText('password');
    screen.getByRole('button', { name: 'Sign up' });
  });

  it('shows a validation error when the first name is missing', async () => {
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    fillForm({
      firstName: '',
      lastName: 'Smith',
      email: 'user@example.com',
      password: 'supersecret123',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await screen.findByText('firstNameRequired');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('calls the auth client with a composed name and onSuccess with valid input', async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    render(<SignUpForm onSuccess={onSuccess} submitLabel="Sign up" />);

    fillForm({
      firstName: 'Oleksii',
      lastName: 'Budnik',
      email: 'user@example.com',
      password: 'supersecret123',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith({
        firstName: 'Oleksii',
        lastName: 'Budnik',
        name: 'Oleksii Budnik',
        email: 'user@example.com',
        password: 'supersecret123',
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL);
    });
  });

  it('submits without a last name and composes the name from the first name only', async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    fillForm({
      firstName: 'Oleksii',
      lastName: '',
      email: 'user@example.com',
      password: 'supersecret123',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith({
        firstName: 'Oleksii',
        name: 'Oleksii',
        email: 'user@example.com',
        password: 'supersecret123',
      });
    });
  });

  it('surfaces a user-already-exists error from the auth client', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: 'USER_ALREADY_EXISTS' } });
    render(<SignUpForm onSuccess={vi.fn()} submitLabel="Sign up" />);

    fillForm({
      firstName: 'Oleksii',
      lastName: 'Budnik',
      email: 'user@example.com',
      password: 'supersecret123',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await screen.findByText('userExists');
  });
});
