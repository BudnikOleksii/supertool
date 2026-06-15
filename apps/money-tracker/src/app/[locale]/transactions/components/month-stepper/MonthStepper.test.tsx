import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MonthStepper } from './MonthStepper';

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
  useLocale: () => 'en-US',
  useTranslations: () => (key: string) => key,
}));

describe('MonthStepper', () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams();
  });

  it('navigates to the previous month', () => {
    render(<MonthStepper period="2025-03" />);

    fireEvent.click(screen.getByRole('button', { name: 'previous' }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/transactions', query: { period: '2025-02' } },
      { scroll: false },
    );
  });

  it('navigates to the next month', () => {
    render(<MonthStepper period="2025-03" />);

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/transactions', query: { period: '2025-04' } },
      { scroll: false },
    );
  });

  it('rolls over to the next January from December', () => {
    render(<MonthStepper period="2025-12" />);

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/transactions', query: { period: '2026-01' } },
      { scroll: false },
    );
  });

  it('preserves active filters and sort while resetting the page on a step', () => {
    searchParams.value = new URLSearchParams(
      'type=expense&categoryId=cat-1&sortBy=amount&sortOrder=asc&page=3',
    );
    render(<MonthStepper period="2025-03" />);

    fireEvent.click(screen.getByRole('button', { name: 'previous' }));

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: '/transactions',
        query: {
          type: 'expense',
          categoryId: 'cat-1',
          sortBy: 'amount',
          sortOrder: 'asc',
          period: '2025-02',
        },
      },
      { scroll: false },
    );
  });
});
