import type { Meta, StoryObj } from '@storybook/react-vite';

import { screen, userEvent, within } from 'storybook/test';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { toast } from '@supertool/ui/src/components/molecules/toaster/toast';
import { Toaster } from '@supertool/ui/src/components/molecules/toaster/Toaster';

const meta = {
  title: 'Primitives/Toaster',
  component: Toaster,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

const resolveTheme = (theme: string): 'light' | 'dark' => (theme === 'dark' ? 'dark' : 'light');

const ToasterDemo = ({ theme }: { theme: 'light' | 'dark' }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    <Toaster theme={theme} position="top-center" />
    <Button
      onClick={() => {
        toast.success('Transaction saved');
      }}
    >
      Show success
    </Button>
    <Button
      variant="outline"
      onClick={() => {
        toast.error('Could not save transaction');
      }}
    >
      Show error
    </Button>
  </div>
);

export const Default: Story = {
  render: (_args, { globals }) => <ToasterDemo theme={resolveTheme(globals.theme)} />,
};

export const WithToast: Story = {
  render: (_args, { globals }) => <ToasterDemo theme={resolveTheme(globals.theme)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Show success' }));
    await screen.findByText('Transaction saved');
  },
};
