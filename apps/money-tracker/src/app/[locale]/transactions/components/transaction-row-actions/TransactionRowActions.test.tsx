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
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
}));

const TRANSACTION_ID = 'transaction-1';
const PERIOD = '2025-02';
const PAGE = 2;
const LOCALE = 'en';

const renderActions = (): void => {
  render(
    <TransactionRowActions
      id={TRANSACTION_ID}
      period={PERIOD}
      page={PAGE}
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
