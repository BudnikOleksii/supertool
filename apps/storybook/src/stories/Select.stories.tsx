import type { Meta, StoryObj } from '@storybook/react-vite';

import { useState } from 'react';
import { fn, screen, userEvent, within } from 'storybook/test';

import type { SelectOption, SelectProps } from '@supertool/ui/src/components/atoms/select/Select';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';

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

export const Open: Story = {
  args: {
    value: 'food',
    onValueChange: fn(),
    optionList: OPTION_LIST,
    ariaLabel: 'Category',
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', enabled: false }],
      },
    },
  },
  render: (args) => <ControlledSelect {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: 'Category' });

    await userEvent.click(trigger);
    await screen.findByRole('listbox');
  },
};

export const Error: Story = {
  args: {
    value: 'food',
    onValueChange: fn(),
    optionList: OPTION_LIST,
    ariaLabel: 'Category',
    error: true,
  },
  render: (args) => <ControlledSelect {...args} />,
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
