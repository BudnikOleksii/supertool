import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton } from '@supertool/ui/src/components/atoms/skeleton/Skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Line: Story = {
  args: { width: 240, height: 16 },
};

export const Avatar: Story = {
  args: { width: 48, height: 48, style: { borderRadius: '50%' } },
};

export const Card: Story = {
  args: { width: 280, height: 120 },
};
