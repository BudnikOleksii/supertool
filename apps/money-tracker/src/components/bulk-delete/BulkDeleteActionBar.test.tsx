import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BulkDeleteActionBar } from './BulkDeleteActionBar';

const renderBar = ({ isSubmitting = false }: { isSubmitting?: boolean } = {}) => {
  const onSelectAllVisible = vi.fn();
  const onClear = vi.fn();
  const onDelete = vi.fn();

  render(
    <BulkDeleteActionBar
      selectedCountLabel="2 selected"
      selectAllLabel="Select all"
      clearLabel="Clear"
      deleteLabel="Delete"
      areAllVisibleSelected={false}
      isSubmitting={isSubmitting}
      onSelectAllVisible={onSelectAllVisible}
      onClear={onClear}
      onDelete={onDelete}
    />,
  );

  return { onSelectAllVisible, onClear, onDelete };
};

describe('BulkDeleteActionBar', () => {
  it('renders the selected-count label as a region', () => {
    renderBar();

    expect(screen.getByRole('region', { name: '2 selected' })).toBeDefined();
  });

  it('invokes the action callbacks on click', () => {
    const { onSelectAllVisible, onClear, onDelete } = renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onSelectAllVisible).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('disables the controls while submitting', () => {
    renderBar({ isSubmitting: true });

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveProperty('disabled', true);
  });
});
