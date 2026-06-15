import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { DeleteCategoryDialog } from './DeleteCategoryDialog';

const { deleteCategory } = vi.hoisted(() => ({ deleteCategory: vi.fn() }));

vi.mock('../../../../../actions/delete-category', () => ({ deleteCategory }));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}));

const buildCategory = (over: Partial<CategoryResponseDto>): CategoryResponseDto => ({
  id: 'id',
  name: 'Name',
  type: 'expense',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const PARENT = buildCategory({ id: 'p1', name: 'Bills', parentId: null });
const CHILD = buildCategory({ id: 'c1', name: 'Water', parentId: 'p1' });
const LEAF = buildCategory({ id: 'l1', name: 'Coffee', parentId: null });

describe('DeleteCategoryDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('switches to the reassignment variant when the category has children', () => {
    render(
      <DeleteCategoryDialog category={PARENT} categoryList={[PARENT, CHILD]} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));

    screen.getByText('delete.reassignTransactionsLabel');
    screen.getByText('delete.reassignChildrenLabel');
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it('deletes directly when the category has no children', async () => {
    deleteCategory.mockResolvedValue({ status: 'success' });
    render(<DeleteCategoryDialog category={LEAF} categoryList={[LEAF]} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));

    await waitFor(() => {
      expect(deleteCategory).toHaveBeenCalledWith('l1', {});
    });
  });

  it('blocks deletion until a subcategory target is chosen instead of defaulting to top level', async () => {
    render(
      <DeleteCategoryDialog category={PARENT} categoryList={[PARENT, CHILD]} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));

    await screen.findByText('reassignChildrenRequired');
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it('requires a transaction target after a 422 instead of resubmitting an empty body', async () => {
    deleteCategory.mockResolvedValue({ status: 'error', code: 'UNPROCESSABLE_ENTITY' });
    render(<DeleteCategoryDialog category={LEAF} categoryList={[LEAF]} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));

    await waitFor(() => {
      expect(deleteCategory).toHaveBeenCalledWith('l1', {});
    });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));
      screen.getByText('reassignTransactionsRequired');
    });
    expect(deleteCategory).toHaveBeenCalledOnce();
  });
});
