import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <CardTitle>Monthly summary</CardTitle>
        <CardDescription>Your spending in June 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <Typography variant="body-m">Total spent: $1,240.50 across 38 transactions.</Typography>
      </CardContent>
      <CardFooter>
        <Typography variant="body-s">Updated moments ago</Typography>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <CardTitle>Groceries</CardTitle>
        <CardDescription>Category budget</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Typography variant="body-m">$420 of $600 used.</Typography>
      </CardContent>
    </Card>
  ),
};
