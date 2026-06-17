import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TransactionRowActions } from './TransactionRowActions';

const { deleteTransaction } = vi.hoisted(() => ({ deleteTransaction: vi.fn() }));

vi.mock('../../../../../actions/delete-transaction', () => ({ deleteTransaction }));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

const TRANSACTION_ID = 'transaction-1';
const PERIOD = '2025-02';
const PAGE = 2;
const LOCALE = 'en';
const TYPE = 'expense';
const CATEGORY_ID = 'category-1';
const SORT_BY = 'amount';
const SORT_ORDER = 'asc';

const renderActions = (): void => {
  render(
    <TransactionRowActions
      id={TRANSACTION_ID}
      period={PERIOD}
      page={PAGE}
      type={TYPE}
      categoryId={CATEGORY_ID}
      sortBy={SORT_BY}
      sortOrder={SORT_ORDER}
      formattedAmount="₴1,234.56"
      formattedDate="Feb 3, 2025"
    />,
  );
};

const openDialog = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
};

describe('TransactionRowActions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('links the copy and edit actions to their generated routes', () => {
    renderActions();

    expect(screen.getByRole('link', { name: 'actions.copy' }).getAttribute('href')).toBe(
      `/transactions/new?copyFrom=${TRANSACTION_ID}`,
    );
    expect(screen.getByRole('link', { name: 'actions.edit' }).getAttribute('href')).toBe(
      `/transactions/${TRANSACTION_ID}/edit`,
    );
  });

  it('calls deleteTransaction with the id when the deletion is confirmed', async () => {
    deleteTransaction.mockResolvedValue({ status: 'success' });
    renderActions();

    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));

    await waitFor(() => {
      expect(deleteTransaction).toHaveBeenCalledWith({
        id: TRANSACTION_ID,
        period: PERIOD,
        page: PAGE,
        locale: LOCALE,
        view: {
          type: TYPE,
          categoryId: CATEGORY_ID,
          sortBy: SORT_BY,
          sortOrder: SORT_ORDER,
        },
      });
    });
  });

  it('does not delete when the dialog is cancelled', () => {
    renderActions();

    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'delete.cancel' }));

    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('shows the localized error and keeps the dialog open when deletion fails', async () => {
    deleteTransaction.mockResolvedValue({ status: 'error', code: 'NOT_FOUND' });
    renderActions();

    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'delete.confirm' }));

    await screen.findByText('NOT_FOUND');
    screen.getByRole('button', { name: 'delete.confirm' });
  });
});
