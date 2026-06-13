import type { Meta, StoryObj } from '@storybook/react-vite';

import { screen, userEvent, within } from 'storybook/test';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@supertool/ui/src/components/molecules/alert-dialog/AlertDialog';

const meta = {
  title: 'Primitives/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AlertDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const AlertDialogDemo = () => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive">Delete transaction</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes the entry. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel asChild>
          <Button variant="outline">Cancel</Button>
        </AlertDialogCancel>
        <AlertDialogAction asChild>
          <Button variant="destructive">Delete</Button>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export const Default: Story = {
  render: () => <AlertDialogDemo />,
};

export const Open: Story = {
  render: () => <AlertDialogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Delete transaction' }));
    await screen.findByRole('alertdialog');
  },
};
