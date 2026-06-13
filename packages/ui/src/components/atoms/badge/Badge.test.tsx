import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

const VARIANT_BADGE_COUNT = 7;

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>New</Badge>);

    screen.getByText('New');
  });

  it('exposes the badge data slot', () => {
    render(<Badge>New</Badge>);

    expect(screen.getByText('New').getAttribute('data-slot')).toBe('badge');
  });

  it('renders every variant', () => {
    render(
      <>
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="ghost">Ghost</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
      </>,
    );

    const badgeList = screen.getAllByText(
      /Default|Secondary|Destructive|Outline|Ghost|Success|Warning/,
    );
    expect(badgeList).toHaveLength(VARIANT_BADGE_COUNT);
  });
});
