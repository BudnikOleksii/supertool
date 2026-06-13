import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders a checkbox role', () => {
    render(<Checkbox aria-label="Accept" />);

    screen.getByRole('checkbox', { name: 'Accept' });
  });

  it('toggles its checked state on click', () => {
    render(<Checkbox aria-label="Accept" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Accept' });

    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });

  it('marks the control invalid in the error state', () => {
    render(<Checkbox aria-label="Accept" error />);

    expect(screen.getByRole('checkbox', { name: 'Accept' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
});
