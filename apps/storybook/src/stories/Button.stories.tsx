import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';

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

export const Outline: Story = {
  args: { children: 'Filter', variant: 'outline' },
};

export const Ghost: Story = {
  args: { children: 'Skip for now', variant: 'ghost' },
};

export const Link: Story = {
  args: { children: 'View report', variant: 'link' },
};

export const Destructive: Story = {
  args: { children: 'Delete transaction', variant: 'destructive' },
};

export const Small: Story = {
  args: { children: 'Small action', size: 'sm' },
};

export const Large: Story = {
  args: { children: 'Large action', size: 'lg' },
};

export const Icon: Story = {
  args: { children: '✕', size: 'icon', 'aria-label': 'Close' },
};

export const Disabled: Story = {
  args: { children: 'Unavailable', disabled: true },
};

export const AsLink: Story = {
  args: { children: 'Open transactions', component: 'a', href: '#transactions' },
};
