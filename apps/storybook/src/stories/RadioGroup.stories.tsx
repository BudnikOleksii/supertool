import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  RadioGroup,
  RadioGroupItem,
} from '@supertool/ui/src/components/atoms/radio-group/RadioGroup';

const meta = {
  title: 'Primitives/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="expense" aria-label="Transaction type" style={{ width: 280 }}>
      <RadioGroupItem value="income">Income</RadioGroupItem>
      <RadioGroupItem value="expense">Expense</RadioGroupItem>
    </RadioGroup>
  ),
};

export const ThreeOptions: Story = {
  render: () => (
    <RadioGroup defaultValue="month" aria-label="Period" style={{ width: 320 }}>
      <RadioGroupItem value="day">Day</RadioGroupItem>
      <RadioGroupItem value="week">Week</RadioGroupItem>
      <RadioGroupItem value="month">Month</RadioGroupItem>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="income" aria-label="Transaction type" disabled style={{ width: 280 }}>
      <RadioGroupItem value="income">Income</RadioGroupItem>
      <RadioGroupItem value="expense">Expense</RadioGroupItem>
    </RadioGroup>
  ),
};
