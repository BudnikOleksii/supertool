import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@supertool/ui/src/components/button/button';
import { Dialog } from '@supertool/ui/src/components/dialog/dialog';

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
