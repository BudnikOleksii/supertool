import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { CategoryTree } from './CategoryTree';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock('../../../../../actions/delete-category', () => ({ deleteCategory: vi.fn() }));

const buildCategory = (over: Partial<CategoryResponseDto>): CategoryResponseDto => ({
  id: 'id',
  name: 'Name',
  type: 'expense',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const CATEGORY_LIST: CategoryResponseDto[] = [
  buildCategory({ id: 'p1', name: 'Bills', type: 'expense', parentId: null }),
  buildCategory({ id: 'c1', name: 'Water', type: 'expense', parentId: 'p1' }),
  buildCategory({ id: 'i1', name: 'Salary', type: 'income', parentId: null }),
];

describe('CategoryTree', () => {
  it('renders the top-level categories', () => {
    render(<CategoryTree categoryList={CATEGORY_LIST} />);

    screen.getByText('Bills');
    screen.getByText('Salary');
  });

  it('reveals child categories when a parent is expanded', () => {
    render(<CategoryTree categoryList={CATEGORY_LIST} />);

    fireEvent.click(screen.getByRole('button', { name: /Bills/u }));

    screen.getByText('Water');
  });

  it('renders the empty state when there are no categories', () => {
    render(<CategoryTree categoryList={[]} />);

    screen.getByText('emptyTitle');
  });

  it('opens the delete dialog when a delete action is clicked', () => {
    render(<CategoryTree categoryList={CATEGORY_LIST} />);

    const [firstDeleteButton] = screen.getAllByRole('button', { name: 'deleteButton' });

    if (!firstDeleteButton) {
      throw new Error('expected at least one delete button');
    }

    fireEvent.click(firstDeleteButton);

    screen.getByText('delete.title');
  });
});
