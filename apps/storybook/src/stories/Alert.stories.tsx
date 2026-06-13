import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@supertool/ui/src/components/atoms/alert/Alert';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';

const meta = {
  title: 'Primitives/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Your monthly budget is almost spent.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>We could not process the last transaction.</AlertDescription>
    </Alert>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Sync paused</AlertTitle>
      <AlertDescription>Reconnect to refresh your transactions.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline">
          Reconnect
        </Button>
      </AlertAction>
    </Alert>
  ),
};
