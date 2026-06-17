import type { Mock } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { CategoryPicker } from './CategoryPicker';

const TIMESTAMP = '2025-02-03T00:00:00.000Z';
const PLACEHOLDER = 'Select a category';
const ARIA_LABEL = 'Category';
const ALL_CATEGORIES_LABEL = 'All categories';

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
    id: 'groceries',
    name: 'Groceries',
    type: 'expense',
    parentId: 'food',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  {
    id: 'taxi',
    name: 'Taxi',
    type: 'expense',
    parentId: 'food',
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

interface RenderOptions {
  value?: string;
  showAllOption?: boolean;
  onValueChange?: Mock;
}

const renderPicker = ({
  value = '',
  showAllOption = false,
  onValueChange = vi.fn(),
}: RenderOptions = {}): { onValueChange: Mock } => {
  render(
    <CategoryPicker
      categoryList={CATEGORY_LIST}
      transactionType=""
      value={value}
      onValueChange={onValueChange}
      placeholder={PLACEHOLDER}
      ariaLabel={ARIA_LABEL}
      getParentOptionLabel={(parentName) => `All ${parentName}`}
      showAllOption={showAllOption}
      allCategoriesLabel={ALL_CATEGORIES_LABEL}
    />,
  );

  return { onValueChange };
};

const openPicker = (): void => {
  fireEvent.click(screen.getByRole('button', { name: ARIA_LABEL }));
};

describe('CategoryPicker', () => {
  it('shows the placeholder when nothing is selected and no all-option', () => {
    renderPicker({ value: '' });

    expect(screen.getByRole('button', { name: ARIA_LABEL }).textContent).toContain(PLACEHOLDER);
  });

  it('shows the all-categories label when the all-option is enabled and nothing is selected', () => {
    renderPicker({ value: '', showAllOption: true });

    expect(screen.getByRole('button', { name: ARIA_LABEL }).textContent).toContain(
      ALL_CATEGORIES_LABEL,
    );
  });

  it('selects a leaf main category immediately on click', () => {
    const { onValueChange } = renderPicker();

    openPicker();
    fireEvent.click(screen.getByRole('option', { name: 'Salary' }));

    expect(onValueChange).toHaveBeenCalledWith('salary');
  });

  it('reveals subcategories in a second pane for a parent with children', () => {
    renderPicker();

    openPicker();
    fireEvent.click(screen.getByRole('option', { name: 'Food' }));

    expect(screen.getByRole('option', { name: 'Groceries' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Taxi' })).toBeTruthy();
  });

  it('selects a subcategory on click', () => {
    const { onValueChange } = renderPicker();

    openPicker();
    fireEvent.click(screen.getByRole('option', { name: 'Food' }));
    fireEvent.click(screen.getByRole('option', { name: 'Groceries' }));

    expect(onValueChange).toHaveBeenCalledWith('groceries');
  });

  it('selects the parent itself via the parent option', () => {
    const { onValueChange } = renderPicker();

    openPicker();
    fireEvent.click(screen.getByRole('option', { name: 'Food' }));
    fireEvent.click(screen.getByRole('option', { name: 'All Food' }));

    expect(onValueChange).toHaveBeenCalledWith('food');
  });

  it('shows the selected parent/child path on the trigger', () => {
    renderPicker({ value: 'groceries' });

    expect(screen.getByRole('button', { name: ARIA_LABEL }).textContent).toContain(
      'Food / Groceries',
    );
  });
});
