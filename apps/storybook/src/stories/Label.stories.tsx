import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import { Label } from '@supertool/ui/src/components/atoms/label/Label';

const meta = {
  title: 'Primitives/Label',
  component: Label,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Amount' },
};

export const WithInput: Story = {
  args: { children: 'Amount', htmlFor: 'amount-input' },
  render: (args) => (
    <div style={{ display: 'grid', gap: '8px' }}>
      <Label {...args} />
      <Input id="amount-input" placeholder="0.00" />
    </div>
  ),
};
