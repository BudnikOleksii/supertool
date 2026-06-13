import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Combobox } from './Combobox';

const OPTION_LIST = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'de', label: 'German' },
];

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

describe('Combobox', () => {
  it('renders a closed trigger showing the placeholder', () => {
    render(
      <Combobox optionList={OPTION_LIST} placeholder="Pick a language" onValueChange={vi.fn()} />,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain('Pick a language');
  });

  it('filters the options by the search query when open', () => {
    render(
      <Combobox optionList={OPTION_LIST} searchLabel="Search options" onValueChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search options' }), {
      target: { value: 'Eng' },
    });

    screen.getByRole('option', { name: 'English' });
    expect(screen.queryByRole('option', { name: 'Ukrainian' })).toBeNull();
  });

  it('selects an option on click and notifies the consumer', () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        optionList={OPTION_LIST}
        searchLabel="Search options"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Ukrainian' }));

    expect(onValueChange).toHaveBeenCalledWith('uk');
  });

  it('ignores arrow navigation when the filtered list is empty', () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        optionList={OPTION_LIST}
        searchLabel="Search options"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    const input = screen.getByRole('combobox', { name: 'Search options' });
    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.queryByRole('option')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation and selection', () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        optionList={OPTION_LIST}
        searchLabel="Search options"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    const input = screen.getByRole('combobox', { name: 'Search options' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledWith('en');
  });
});
