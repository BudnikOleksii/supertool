import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Typography } from './Typography';

describe('Typography', () => {
  it('renders a paragraph by default', () => {
    render(<Typography>Body copy</Typography>);

    expect(screen.getByText('Body copy').tagName).toBe('P');
  });

  it('maps title variants to their semantic heading tags', () => {
    render(
      <>
        <Typography variant="title-xl">Extra large</Typography>
        <Typography variant="title-l">Large</Typography>
        <Typography variant="title-m">Medium</Typography>
        <Typography variant="title-s">Small</Typography>
        <Typography variant="title-xs">Extra small</Typography>
      </>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Extra large' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Large' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Medium' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 4, name: 'Small' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 5, name: 'Extra small' })).toBeDefined();
  });

  it('renders the explicit tag over the variant default', () => {
    render(
      <Typography variant="title-m" tag="span">
        Inline title
      </Typography>,
    );

    expect(screen.getByText('Inline title').tagName).toBe('SPAN');
  });

  it('applies the font weight through inline style', () => {
    render(<Typography fontWeight="semibold">Weighted</Typography>);

    expect(screen.getByText('Weighted').style.fontWeight).toBe('var(--font-weight-semibold)');
  });
});
