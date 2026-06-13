import type { Meta, StoryObj } from '@storybook/react-vite';

import { screen, userEvent, within } from 'storybook/test';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Dialog } from '@supertool/ui/src/components/molecules/dialog/Dialog';

const meta = {
  title: 'Primitives/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    trigger: <Button>Add transaction</Button>,
    title: 'Add transaction',
    description: 'Record a new expense or income entry.',
    closeLabel: 'Close',
    children: <p>Transaction form fields arrive in a later story.</p>,
  },
};

export const Open: Story = {
  args: {
    trigger: <Button>Add transaction</Button>,
    title: 'Add transaction',
    description: 'Record a new expense or income entry.',
    closeLabel: 'Close',
    children: <p>Transaction form fields arrive in a later story.</p>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Add transaction' });

    await userEvent.click(trigger);
    await screen.findByRole('dialog');
  },
};
