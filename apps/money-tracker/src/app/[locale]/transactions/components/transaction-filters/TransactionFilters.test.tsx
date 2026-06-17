import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import type { TransactionsSearchParams } from '../../utils/parse-transactions-search-params';

import { TransactionFilters } from './TransactionFilters';

const { replace, searchParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: { value: new URLSearchParams() },
}));

interface StubOption {
  value: string;
  label: string;
}

interface StubProps {
  value: string;
  onValueChange: (value: string) => void;
  optionList: StubOption[];
  ariaLabel?: string;
  searchLabel?: string;
}

const { renderStubSelect } = vi.hoisted(() => ({
  renderStubSelect:
    () =>
    ({ value, onValueChange, optionList, ariaLabel, searchLabel }: StubProps) => (
      <select
        aria-label={ariaLabel ?? searchLabel}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
      >
        <option value="" />
        {optionList.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
}));

vi.mock('@supertool/ui/src/components/atoms/select/Select', () => ({
  Select: renderStubSelect(),
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

const TIMESTAMP = '2025-02-03T00:00:00.000Z';

const CATEGORY_LIST: CategoryResponseDto[] = [
  {
    id: 'food',
    name: 'Food',
    type: 'expense',
    parentId: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  {
    id: 'salary',
    name: 'Salary',
    type: 'income',
    parentId: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
];

const buildParams = (
  overrides: Partial<TransactionsSearchParams> = {},
): TransactionsSearchParams => ({
  period: '2025-03',
  page: 3,
  sortBy: 'date',
  sortOrder: 'desc',
  ...overrides,
});

const setSearchParams = (params: TransactionsSearchParams): void => {
  const next = new URLSearchParams({ period: params.period, page: String(params.page) });

  if (params.type !== undefined) {
    next.set('type', params.type);
  }

  if (params.categoryId !== undefined) {
    next.set('categoryId', params.categoryId);
  }

  next.set('sortBy', params.sortBy);
  next.set('sortOrder', params.sortOrder);
  searchParams.value = next;
};

const renderFilters = (params: TransactionsSearchParams): void => {
  setSearchParams(params);
  render(<TransactionFilters categoryList={CATEGORY_LIST} params={params} />);
};

const getReplaceQuery = (): Record<string, string> => {
  const [call] = replace.mock.calls;
  const [href] = call ?? [];

  return href.query;
};

describe('TransactionFilters', () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams();
  });

  it('writes the type param and resets the page', () => {
    renderFilters(buildParams());

    fireEvent.change(screen.getByLabelText('typeLabel'), { target: { value: 'expense' } });

    const query = getReplaceQuery();
    expect(query).toMatchObject({ period: '2025-03', type: 'expense' });
    expect(query).not.toHaveProperty('page');
  });

  it('writes the category param and resets the page', () => {
    renderFilters(buildParams());

    fireEvent.click(screen.getByRole('button', { name: 'categoryAll' }));
    fireEvent.click(screen.getByRole('option', { name: 'Food' }));

    const query = getReplaceQuery();
    expect(query).toMatchObject({ period: '2025-03', categoryId: 'food' });
    expect(query).not.toHaveProperty('page');
  });

  it('clears a stale categoryId that is not a valid category', () => {
    renderFilters(buildParams({ categoryId: 'deleted-category' }));

    const query = getReplaceQuery();
    expect(query).not.toHaveProperty('categoryId');
    expect(query).toMatchObject({ period: '2025-03' });
  });

  it('clears a categoryId whose type does not match the active type filter', () => {
    renderFilters(buildParams({ type: 'expense', categoryId: 'salary' }));

    const query = getReplaceQuery();
    expect(query).not.toHaveProperty('categoryId');
    expect(query).toMatchObject({ type: 'expense' });
  });

  it('keeps a valid categoryId without auto-clearing', () => {
    renderFilters(buildParams({ type: 'expense', categoryId: 'food' }));

    expect(replace).not.toHaveBeenCalled();
  });

  it('writes the sortBy param and resets the page', () => {
    renderFilters(buildParams());

    fireEvent.change(screen.getByLabelText('sortByLabel'), { target: { value: 'amount' } });

    const query = getReplaceQuery();
    expect(query).toMatchObject({ period: '2025-03', sortBy: 'amount' });
    expect(query).not.toHaveProperty('page');
  });

  it('clears the filters while preserving the period and sort', () => {
    renderFilters(buildParams({ type: 'expense', categoryId: 'food' }));

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    const query = getReplaceQuery();
    expect(query).toMatchObject({
      period: '2025-03',
      sortBy: 'date',
      sortOrder: 'desc',
    });
    expect(query).not.toHaveProperty('type');
    expect(query).not.toHaveProperty('categoryId');
    expect(query).not.toHaveProperty('page');
  });

  it('does not render the clear control when no filters are active', () => {
    renderFilters(buildParams());

    expect(screen.queryByRole('button', { name: 'clear' })).toBeNull();
  });
});
