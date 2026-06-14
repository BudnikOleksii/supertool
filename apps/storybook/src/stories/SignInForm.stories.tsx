import type { Meta, StoryObj } from '@storybook/react-vite';

import { NextIntlClientProvider } from 'next-intl';

import { SignInForm } from '@supertool/widgets/src/components/sign-in-form/SignInForm';

const messages = {
  authShared: {
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    name: 'Name',
    namePlaceholder: 'Your name',
    errors: {
      emailInvalid: 'Please enter a valid email address',
      passwordRequired: 'Password is required',
      passwordMinLength: 'Password must be at least 8 characters',
      nameRequired: 'Name is required',
      invalidCredentials: 'Invalid email or password',
      userExists: 'An account with this email already exists',
      rateLimited: 'Too many attempts. Please try again later.',
      generic: 'Something went wrong. Please try again.',
    },
  },
};

const meta = {
  title: 'Widgets/SignInForm',
  component: SignInForm,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { submitLabel: 'Sign in', onSuccess: () => undefined },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <div style={{ width: 360 }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
} satisfies Meta<typeof SignInForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
