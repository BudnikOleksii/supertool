import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UnderlineLink } from './UnderlineLink';

describe('UnderlineLink', () => {
  it('renders an anchor by default', () => {
    render(<UnderlineLink href="/transactions">Transactions</UnderlineLink>);

    expect(screen.getByRole('link', { name: 'Transactions' }).getAttribute('href')).toBe(
      '/transactions',
    );
  });

  it('renders a custom element through the component prop', () => {
    render(
      <UnderlineLink component="button" type="button">
        Open
      </UnderlineLink>,
    );

    screen.getByRole('button', { name: 'Open' });
  });
});
