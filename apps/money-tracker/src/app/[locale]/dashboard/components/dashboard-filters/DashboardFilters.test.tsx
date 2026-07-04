import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardFilters } from './DashboardFilters';

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
}

const { renderStubSelect } = vi.hoisted(() => ({
  renderStubSelect:
    () =>
    ({ value, onValueChange, optionList, ariaLabel }: StubProps) => (
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
      >
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

vi.mock('@supertool/ui/src/components/atoms/input/Input', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock('./DashboardFilters.module.scss', () => ({
  default: new Proxy({}, { get: (_target, key) => key }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.value,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const RANGE = { dateFrom: '2025-02-01', dateTo: '2025-02-28' };

const setSearchParams = (params: Record<string, string>): void => {
  searchParams.value = new URLSearchParams(params);
};

const getReplaceQuery = (): Record<string, string> => {
  const [call] = replace.mock.calls;
  const [href] = call ?? [];

  return href.query;
};

describe('DashboardFilters', () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams();
  });

  it('writes the dateFrom param and resets the page', () => {
    setSearchParams({ dateFrom: '2025-02-01', dateTo: '2025-02-28', page: '3' });

    render(<DashboardFilters {...RANGE} />);

    fireEvent.change(screen.getByLabelText('dateFrom'), { target: { value: '2025-01-01' } });

    const query = getReplaceQuery();
    expect(query).toMatchObject({ dateFrom: '2025-01-01', dateTo: '2025-02-28' });
    expect(query).not.toHaveProperty('page');
  });

  it('writes the dateTo param and resets the page', () => {
    setSearchParams({ dateFrom: '2025-02-01', dateTo: '2025-02-28', page: '3' });

    render(<DashboardFilters {...RANGE} />);

    fireEvent.change(screen.getByLabelText('dateTo'), { target: { value: '2025-03-31' } });

    const query = getReplaceQuery();
    expect(query).toMatchObject({ dateFrom: '2025-02-01', dateTo: '2025-03-31' });
    expect(query).not.toHaveProperty('page');
  });

  it('writes the type param when a concrete type is selected', () => {
    setSearchParams({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });

    render(<DashboardFilters {...RANGE} />);

    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'income' } });

    expect(getReplaceQuery()).toMatchObject({ type: 'income' });
  });

  it('removes the type param when the all option is selected', () => {
    setSearchParams({ dateFrom: '2025-02-01', dateTo: '2025-02-28', type: 'income' });

    render(<DashboardFilters {...RANGE} type="income" />);

    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'all' } });

    const query = getReplaceQuery();
    expect(query).not.toHaveProperty('type');
    expect(query).toMatchObject({ dateFrom: '2025-02-01', dateTo: '2025-02-28' });
  });
});
