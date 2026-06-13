import type { Meta, StoryObj } from '@storybook/react-vite';

import { Separator } from '@supertool/ui/src/components/atoms/separator/Separator';

const meta = {
  title: 'Primitives/Separator',
  component: Separator,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

const TEXT_STYLE = {
  fontFamily: 'var(--default-font-family)',
  color: 'var(--on-surface)',
};

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <p style={TEXT_STYLE}>Income</p>
      <Separator />
      <p style={TEXT_STYLE}>Expenses</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 24 }}>
      <span style={TEXT_STYLE}>Day</span>
      <Separator orientation="vertical" />
      <span style={TEXT_STYLE}>Week</span>
      <Separator orientation="vertical" />
      <span style={TEXT_STYLE}>Month</span>
    </div>
  ),
};
