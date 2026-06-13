import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from '@supertool/ui/src/components/atoms/checkbox/Checkbox';

const meta = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { 'aria-label': 'Include in report' },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: { defaultChecked: false },
};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Indeterminate: Story = {
  args: { checked: 'indeterminate' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const Error: Story = {
  args: { error: true },
};
