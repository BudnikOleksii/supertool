import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './Label';

describe('Label', () => {
  it('associates with a form control through htmlFor', () => {
    render(
      <>
        <Label htmlFor="amount">Amount</Label>
        <input id="amount" />
      </>,
    );

    expect(screen.getByLabelText('Amount')).toBeDefined();
  });

  it('merges custom className with the base class', () => {
    render(<Label className="custom">Amount</Label>);

    expect(screen.getByText('Amount').className).toContain('custom');
  });
});
