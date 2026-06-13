import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

const EXPECTED_NEXT_PAGE = 3;
const EXPECTED_CLAMPED_PREVIOUS_PAGE = 4;

describe('Pagination', () => {
  it('renders nothing when there is only a single page', () => {
    const { container } = render(
      <Pagination page={1} limit={20} total={10} onPageChange={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('disables the previous control on the first page', () => {
    render(<Pagination page={1} limit={20} total={100} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', false);
    screen.getByText('1 / 5');
  });

  it('advances the page when next is activated', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} limit={20} total={100} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(EXPECTED_NEXT_PAGE);
  });

  it('renders nothing when the limit is not positive', () => {
    const { container } = render(
      <Pagination page={1} limit={0} total={100} onPageChange={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('clamps an out-of-range page into the valid range', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={99} limit={20} total={100} onPageChange={onPageChange} />);

    screen.getByText('5 / 5');
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onPageChange).toHaveBeenCalledWith(EXPECTED_CLAMPED_PREVIOUS_PAGE);
  });
});
