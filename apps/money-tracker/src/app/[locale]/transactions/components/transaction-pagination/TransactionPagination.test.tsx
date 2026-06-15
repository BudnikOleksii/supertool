import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TransactionPagination } from './TransactionPagination';

const { replace, searchParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: { value: new URLSearchParams() },
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/transactions',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.value,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const LIMIT = 50;
const MULTI_PAGE_TOTAL = 120;
const SINGLE_PAGE_TOTAL = 10;
const CURRENT_PAGE = 2;

describe('TransactionPagination', () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams();
  });

  it('advances the page param while preserving other params', () => {
    searchParams.value = new URLSearchParams('period=2025-03&type=expense');
    render(<TransactionPagination page={CURRENT_PAGE} limit={LIMIT} total={MULTI_PAGE_TOTAL} />);

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/transactions', query: { period: '2025-03', type: 'expense', page: '3' } },
      { scroll: false },
    );
  });

  it('steps back to the previous page while preserving other params', () => {
    searchParams.value = new URLSearchParams('period=2025-03&type=expense&page=2');
    render(<TransactionPagination page={CURRENT_PAGE} limit={LIMIT} total={MULTI_PAGE_TOTAL} />);

    fireEvent.click(screen.getByRole('button', { name: 'previous' }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/transactions', query: { period: '2025-03', type: 'expense', page: '1' } },
      { scroll: false },
    );
  });

  it('renders nothing when the result fits on a single page', () => {
    render(<TransactionPagination page={1} limit={LIMIT} total={SINGLE_PAGE_TOTAL} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
