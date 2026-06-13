import type { Meta, StoryObj } from '@storybook/react-vite';

import { useState } from 'react';
import { fn } from 'storybook/test';

import type { TimePickerProps } from '@supertool/ui/src/components/atoms/time-picker/TimePicker';
import { TimePicker } from '@supertool/ui/src/components/atoms/time-picker/TimePicker';

const ControlledTimePicker = (args: TimePickerProps) => {
  const [value, setValue] = useState(args.value ?? '00:00');

  const handleChange = (nextValue: string) => {
    args.onChange?.(nextValue);
    setValue(nextValue);
  };

  return <TimePicker {...args} value={value} onChange={handleChange} />;
};

const meta = {
  title: 'Primitives/TimePicker',
  component: TimePicker,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { onChange: fn(), hoursLabel: 'Hours', minutesLabel: 'Minutes' },
} satisfies Meta<typeof TimePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <ControlledTimePicker {...args} />,
};

export const WithValue: Story = {
  args: { value: '09:45' },
  render: (args) => <ControlledTimePicker {...args} />,
};

export const Disabled: Story = {
  args: { value: '12:30', disabled: true },
};
