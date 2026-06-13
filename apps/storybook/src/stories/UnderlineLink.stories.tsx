import type { Meta, StoryObj } from '@storybook/react-vite';

import { UnderlineLink } from '@supertool/ui/src/components/atoms/underline-link/UnderlineLink';

const meta = {
  title: 'Primitives/UnderlineLink',
  component: UnderlineLink,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof UnderlineLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'View full report', href: '#report' },
};

export const AsButton: Story = {
  args: { children: 'Forgot password?', component: 'button', type: 'button' },
};
