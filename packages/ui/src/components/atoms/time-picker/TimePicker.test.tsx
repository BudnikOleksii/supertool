import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimePicker } from './TimePicker';

describe('TimePicker', () => {
  it('renders hours and minutes inputs with their labels', () => {
    render(<TimePicker hoursLabel="Hours" minutesLabel="Minutes" />);

    expect(screen.getByRole('textbox', { name: 'Hours' }).getAttribute('value')).toBe('00');
    expect(screen.getByRole('textbox', { name: 'Minutes' }).getAttribute('value')).toBe('00');
  });

  it('emits an HH:MM string when hours change', () => {
    const handleChange = vi.fn();
    render(<TimePicker value="00:30" onChange={handleChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Hours' }), { target: { value: '9' } });

    expect(handleChange).toHaveBeenCalledWith('09:30');
  });

  it('clamps out-of-range input to the maximum', () => {
    const handleChange = vi.fn();
    render(<TimePicker value="00:00" onChange={handleChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Minutes' }), {
      target: { value: '90' },
    });

    expect(handleChange).toHaveBeenCalledWith('00:59');
  });
});
