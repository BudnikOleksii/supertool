import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@supertool/ui/src/components/button/Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: 'Save transaction', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: 'Cancel', variant: 'secondary' },
};

export const Ghost: Story = {
  args: { children: 'Skip for now', variant: 'ghost' },
};

export const Small: Story = {
  args: { children: 'Small action', size: 'small' },
};

export const Large: Story = {
  args: { children: 'Large action', size: 'large' },
};

export const Disabled: Story = {
  args: { children: 'Unavailable', disabled: true },
};
