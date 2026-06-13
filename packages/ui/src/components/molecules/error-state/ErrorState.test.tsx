import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders the title and description without actions by default', () => {
    render(<ErrorState title="Something went wrong" description="We could not load your data." />);

    screen.getByText('Something went wrong');
    screen.getByText('We could not load your data.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('invokes onRetry when the retry action is activated', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Something went wrong"
        description="We could not load your data."
        onRetry={onRetry}
        retryLabel="Try again"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
