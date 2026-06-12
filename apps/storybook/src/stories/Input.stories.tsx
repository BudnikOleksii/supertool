import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '@supertool/ui/src/components/input/Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'Amount', 'aria-label': 'Amount' },
};

export const Disabled: Story = {
  args: { placeholder: 'Amount', 'aria-label': 'Amount', disabled: true },
};
