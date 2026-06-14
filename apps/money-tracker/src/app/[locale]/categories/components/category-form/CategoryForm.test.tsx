import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { CategoryForm } from './CategoryForm';

const { createCategory, updateCategory } = vi.hoisted(() => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));

vi.mock('../../../../../actions/create-category', () => ({ createCategory }));
vi.mock('../../../../../actions/update-category', () => ({ updateCategory }));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}));

const CATEGORY_LIST: CategoryResponseDto[] = [];

describe('CategoryForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the name field and the create submit button', () => {
    render(<CategoryForm category={null} categoryList={CATEGORY_LIST} />);

    screen.getByLabelText('form.nameLabel');
    screen.getByRole('button', { name: 'form.submitCreate' });
  });

  it('shows a validation error and does not submit when the name is empty', async () => {
    createCategory.mockResolvedValue({ status: 'success' });
    render(<CategoryForm category={null} categoryList={CATEGORY_LIST} />);

    fireEvent.click(screen.getByRole('button', { name: 'form.submitCreate' }));

    await screen.findByText('nameRequired');
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('calls the create action with the entered values on a valid submit', async () => {
    createCategory.mockResolvedValue({ status: 'success' });
    render(<CategoryForm category={null} categoryList={CATEGORY_LIST} />);

    fireEvent.change(screen.getByLabelText('form.nameLabel'), { target: { value: 'Groceries' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.submitCreate' }));

    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Groceries', type: 'expense' }),
      );
    });
  });
});
