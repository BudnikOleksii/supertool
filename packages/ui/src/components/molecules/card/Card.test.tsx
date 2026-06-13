import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card';

describe('Card', () => {
  it('renders title, description, content, and footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Monthly summary</CardTitle>
          <CardDescription>Your spending this month</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    screen.getByText('Monthly summary');
    screen.getByText('Your spending this month');
    screen.getByText('Body');
    screen.getByText('Footer');
  });

  it('applies the action layout when a CardAction is present in the header', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>With action</CardTitle>
          <CardAction>
            <button type="button">Manage</button>
          </CardAction>
        </CardHeader>
      </Card>,
    );

    const header = screen.getByText('With action').closest('[data-slot="card-header"]');

    expect(header?.className).toContain('withAction');
  });
});
