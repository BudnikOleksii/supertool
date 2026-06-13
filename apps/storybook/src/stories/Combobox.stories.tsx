import type { Meta, StoryObj } from '@storybook/react-vite';

import { useState } from 'react';
import { screen, userEvent, within } from 'storybook/test';

import { Combobox } from '@supertool/ui/src/components/molecules/combobox/Combobox';

const OPTION_LIST = [
  { value: 'food', label: 'Food & dining' },
  { value: 'transport', label: 'Transport' },
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
];

const meta = {
  title: 'Primitives/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { optionList: OPTION_LIST },
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

const ComboboxDemo = () => {
  const [value, setValue] = useState('');

  return (
    <div style={{ width: 280 }}>
      <Combobox
        optionList={OPTION_LIST}
        value={value}
        onValueChange={setValue}
        placeholder="Select a category"
        searchLabel="Search categories"
        emptyMessage="No categories found"
      />
    </div>
  );
};

export const Default: Story = {
  render: () => <ComboboxDemo />,
};

export const Open: Story = {
  render: () => <ComboboxDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('combobox', { name: 'Select a category' }));
    await userEvent.type(
      await screen.findByRole('combobox', { name: 'Search categories' }),
      'Trans',
    );
    await screen.findByRole('option', { name: 'Transport' });
  },
};
