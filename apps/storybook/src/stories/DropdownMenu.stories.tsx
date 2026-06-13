import type { Meta, StoryObj } from '@storybook/react-vite';

import { screen, userEvent, within } from 'storybook/test';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@supertool/ui/src/components/molecules/dropdown-menu/DropdownMenu';

const meta = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

const DropdownMenuDemo = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">Account actions</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>Profile settings</DropdownMenuItem>
      <DropdownMenuItem>Switch workspace</DropdownMenuItem>
      <DropdownMenuItem>Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const Default: Story = {
  render: () => <DropdownMenuDemo />,
};

export const Open: Story = {
  render: () => <DropdownMenuDemo />,
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', enabled: false }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Account actions' }));
    await screen.findByRole('menuitem', { name: 'Profile settings' });
  },
};
