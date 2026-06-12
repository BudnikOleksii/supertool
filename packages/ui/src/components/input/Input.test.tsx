import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);

    screen.getByRole('textbox');
  });

  it('forwards props to the underlying input', () => {
    render(<Input placeholder="Enter value" aria-label="test input" />);

    const input = screen.getByRole('textbox', { name: 'test input' });

    expect(input).toHaveProperty('placeholder', 'Enter value');
  });

  it('merges custom className with base class', () => {
    render(<Input aria-label="test input" className="custom" />);

    const input = screen.getByRole('textbox', { name: 'test input' });

    expect(input.className).toContain('custom');
  });

  it('marks the input invalid when error is set', () => {
    render(<Input aria-label="amount" error />);

    expect(screen.getByRole('textbox', { name: 'amount' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('stays valid when error is not set', () => {
    render(<Input aria-label="amount" />);

    expect(screen.getByRole('textbox', { name: 'amount' }).getAttribute('aria-invalid')).toBeNull();
  });

  it('renders the start adornment beside the input', () => {
    render(<Input aria-label="amount" startAdornment="₴" />);

    screen.getByText('₴');
    screen.getByRole('textbox', { name: 'amount' });
  });
});
