import type { Meta, StoryObj } from '@storybook/react-vite';

import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

const meta = {
  title: 'Primitives/Typography',
  component: Typography,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Typography>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TitleXl: Story = {
  args: { children: 'Title XL', variant: 'title-xl' },
};

export const TitleL: Story = {
  args: { children: 'Title L', variant: 'title-l' },
};

export const TitleM: Story = {
  args: { children: 'Title M', variant: 'title-m' },
};

export const TitleS: Story = {
  args: { children: 'Title S', variant: 'title-s' },
};

export const TitleXs: Story = {
  args: { children: 'Title XS', variant: 'title-xs' },
};

export const BodyL: Story = {
  args: { children: 'Body L — primary reading size', variant: 'body-l' },
};

export const BodyM: Story = {
  args: { children: 'Body M — default body copy', variant: 'body-m' },
};

export const BodyS: Story = {
  args: { children: 'Body S — captions and helper text', variant: 'body-s' },
};

export const SemiboldBody: Story = {
  args: { children: 'Semibold body copy', variant: 'body-m', fontWeight: 'semibold' },
};

export const CustomTag: Story = {
  args: { children: 'Title styles on a span', variant: 'title-s', tag: 'span' },
};
