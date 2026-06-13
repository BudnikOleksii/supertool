import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@supertool/ui/src/components/atoms/avatar/Avatar';

const meta = {
  title: 'Primitives/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAMPLE_IMAGE = 'https://i.pravatar.cc/96?img=12';

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src={SAMPLE_IMAGE} alt="Oleksii" />
      <AvatarFallback>OB</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="" alt="Oleksii" />
      <AvatarFallback>OB</AvatarFallback>
    </Avatar>
  ),
};

export const Small: Story = {
  render: () => (
    <Avatar size="sm">
      <AvatarFallback>SM</AvatarFallback>
    </Avatar>
  ),
};

export const Large: Story = {
  render: () => (
    <Avatar size="lg">
      <AvatarFallback>LG</AvatarFallback>
    </Avatar>
  ),
};
