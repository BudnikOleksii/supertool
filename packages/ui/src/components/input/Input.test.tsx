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
});
