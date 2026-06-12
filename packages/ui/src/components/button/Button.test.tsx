import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

const VARIANT_BUTTON_COUNT = 6;

describe('Button', () => {
  it('renders its children inside a button role', () => {
    render(<Button>Save</Button>);

    screen.getByRole('button', { name: 'Save' });
  });

  it('defaults to type button', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('supports the disabled state', () => {
    render(<Button disabled>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
  });

  it('renders each variant as a button', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
      </>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(VARIANT_BUTTON_COUNT);
  });

  it('renders the icon size as a button', () => {
    render(<Button size="icon" aria-label="Close" />);

    screen.getByRole('button', { name: 'Close' });
  });

  it('renders a custom element through the component prop', () => {
    render(
      <Button component="a" href="/transactions">
        Open transactions
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Open transactions' }).getAttribute('href')).toBe(
      '/transactions',
    );
  });
});
