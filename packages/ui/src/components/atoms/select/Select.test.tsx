import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Ukrainian' },
];

describe('Select', () => {
  it('renders the trigger with the selected value label', () => {
    render(<Select value="en" onValueChange={vi.fn()} optionList={OPTIONS} ariaLabel="Language" />);

    screen.getByRole('combobox', { name: 'Language' });
  });

  it('marks the trigger invalid when error is set', () => {
    render(
      <Select value="en" onValueChange={vi.fn()} optionList={OPTIONS} ariaLabel="Language" error />,
    );

    expect(screen.getByRole('combobox', { name: 'Language' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('renders in disabled state when disabled prop is true', () => {
    render(
      <Select
        value="en"
        onValueChange={vi.fn()}
        optionList={OPTIONS}
        ariaLabel="Language"
        disabled
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveProperty('disabled', true);
  });
});
