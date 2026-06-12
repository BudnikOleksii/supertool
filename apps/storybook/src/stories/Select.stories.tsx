import type { Meta, StoryObj } from '@storybook/react-vite';

import { useState } from 'react';
import { fn } from 'storybook/test';

import type { SelectOption, SelectProps } from '@supertool/ui/src/components/select/Select';
import { Select } from '@supertool/ui/src/components/select/Select';

const OPTION_LIST: SelectOption[] = [
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'salary', label: 'Salary' },
];

const ControlledSelect = (args: SelectProps) => {
  const [value, setValue] = useState(args.value);

  const handleValueChange = (nextValue: string) => {
    args.onValueChange(nextValue);
    setValue(nextValue);
  };

  return <Select {...args} value={value} onValueChange={handleValueChange} />;
};

const meta = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'food',
    onValueChange: fn(),
    optionList: OPTION_LIST,
    ariaLabel: 'Category',
  },
  render: (args) => <ControlledSelect {...args} />,
};

export const Error: Story = {
  args: {
    value: 'food',
    onValueChange: fn(),
    optionList: OPTION_LIST,
    ariaLabel: 'Category',
    error: true,
  },
};

export const Disabled: Story = {
  args: {
    value: 'food',
    onValueChange: fn(),
    optionList: OPTION_LIST,
    ariaLabel: 'Category',
    disabled: true,
  },
};
