import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeleteAccountSection } from './DeleteAccountSection';

const { deleteAccount } = vi.hoisted(() => ({ deleteAccount: vi.fn() }));

const KNOWN_ERROR_KEY_SET = new Set([
  'emailMismatch',
  'deleteAccountFailed',
  'UNAUTHORIZED',
  'UNKNOWN',
]);

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, {
      has: (key: string) => KNOWN_ERROR_KEY_SET.has(key),
    }),
}));

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));

vi.mock('../../../../../actions/delete-account', () => ({ deleteAccount }));

const EMAIL = 'operator@example.com';

const openDialog = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'deleteAccountButton' }));
};

const getConfirmButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'deleteAccountConfirmButton' });

describe('DeleteAccountSection', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the confirmation dialog from the trigger', () => {
    render(<DeleteAccountSection email={EMAIL} />);
    openDialog();

    expect(screen.getByText('deleteAccountTitle')).toBeDefined();
  });

  it('keeps the confirm button disabled and shows a mismatch error for a wrong value', async () => {
    render(<DeleteAccountSection email={EMAIL} />);
    openDialog();

    fireEvent.change(screen.getByPlaceholderText('deleteAccountConfirmPlaceholder'), {
      target: { value: 'wrong@example.com' },
    });

    expect(getConfirmButton()).toHaveProperty('disabled', true);
    expect(await screen.findByText('emailMismatch')).toBeDefined();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('enables the confirm button and calls the action when the email matches', async () => {
    deleteAccount.mockResolvedValue({ status: 'success' });
    render(<DeleteAccountSection email={EMAIL} />);
    openDialog();

    fireEvent.change(screen.getByPlaceholderText('deleteAccountConfirmPlaceholder'), {
      target: { value: EMAIL },
    });

    await waitFor(() => {
      expect(getConfirmButton()).toHaveProperty('disabled', false);
    });

    fireEvent.click(getConfirmButton());

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledOnce();
    });
  });

  it('does not call the action when cancelled and resets the field', () => {
    render(<DeleteAccountSection email={EMAIL} />);
    openDialog();

    fireEvent.change(screen.getByPlaceholderText('deleteAccountConfirmPlaceholder'), {
      target: { value: EMAIL },
    });
    fireEvent.click(screen.getByRole('button', { name: 'cancelButton' }));

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByText('deleteAccountTitle')).toBeNull();
  });

  it('shows an inline error and keeps the dialog open when the action fails', async () => {
    deleteAccount.mockResolvedValue({ status: 'error', code: 'UNAUTHORIZED' });
    render(<DeleteAccountSection email={EMAIL} />);
    openDialog();

    fireEvent.change(screen.getByPlaceholderText('deleteAccountConfirmPlaceholder'), {
      target: { value: EMAIL },
    });

    await waitFor(() => {
      expect(getConfirmButton()).toHaveProperty('disabled', false);
    });

    fireEvent.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByText('UNAUTHORIZED')).toBeDefined();
    });
    expect(screen.getByText('deleteAccountTitle')).toBeDefined();
  });
});
