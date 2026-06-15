import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';

import { TransactionForm } from './TransactionForm';

const { createTransaction } = vi.hoisted(() => ({ createTransaction: vi.fn() }));

vi.mock('../../../../../actions/create-transaction', () => ({ createTransaction }));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
  redirect: vi.fn(),
}));

const TIMESTAMP = '2025-02-03T00:00:00.000Z';

const buildCategory = (
  override: Partial<CategoryResponseDto> & Pick<CategoryResponseDto, 'id' | 'name' | 'type'>,
): CategoryResponseDto => ({
  parentId: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...override,
});

const CATEGORY_LIST: CategoryResponseDto[] = [
  buildCategory({ id: 'food', name: 'Food', type: 'expense' }),
  buildCategory({ id: 'salary', name: 'Salary', type: 'income' }),
];

const openCategoryCombobox = (): void => {
  fireEvent.click(screen.getByRole('combobox', { name: 'categoryPlaceholder' }));
};

const expectCategoryOptions = (presentName: string, absentName: string): void => {
  screen.getByRole('option', { name: presentName });
  expect(screen.queryByRole('option', { name: absentName })).toBeNull();
};

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TransactionForm', () => {
  it('surfaces the localized amount error and does not submit an invalid form', async () => {
    render(<TransactionForm categoryList={CATEGORY_LIST} defaultCurrency={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await screen.findByText('amountInvalid');
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('re-scopes the category options to the selected type and clears an invalid selection', async () => {
    render(<TransactionForm categoryList={CATEGORY_LIST} defaultCurrency={null} />);

    openCategoryCombobox();
    expectCategoryOptions('Food', 'Salary');

    fireEvent.click(screen.getByRole('option', { name: 'Food' }));
    screen.getByRole('combobox', { name: 'Food' });

    fireEvent.click(screen.getByRole('button', { name: 'typeIncome' }));
    await screen.findByRole('combobox', { name: 'categoryPlaceholder' });

    openCategoryCombobox();
    expectCategoryOptions('Salary', 'Food');
  });

  it('disables the submit button while the create action is pending', async () => {
    createTransaction.mockReturnValue(new Promise(() => {}));
    render(<TransactionForm categoryList={CATEGORY_LIST} defaultCurrency="USD" />);

    fireEvent.change(screen.getByLabelText('amountLabel'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'categoryPlaceholder' }));
    fireEvent.click(screen.getByRole('option', { name: 'Food' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'submit' }).hasAttribute('disabled')).toBe(true);
    });
  });
});
