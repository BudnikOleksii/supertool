import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { ErrorState } from '@supertool/ui/src/components/molecules/error-state/ErrorState';

const meta = {
  title: 'Primitives/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Unable to load transactions',
    description: 'Something went wrong while fetching your data. Please try again.',
  },
};

export const WithActions: Story = {
  args: {
    title: 'Unable to load transactions',
    description: 'Something went wrong while fetching your data. Please try again.',
    onRetry: fn(),
    onNavigateHome: fn(),
    retryLabel: 'Try again',
    navigateHomeLabel: 'Go to homepage',
  },
};
