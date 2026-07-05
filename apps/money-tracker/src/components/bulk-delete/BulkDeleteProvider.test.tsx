import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BulkDeleteProvider } from './BulkDeleteProvider';
import { TransactionSelectCheckbox } from './TransactionSelectCheckbox';

const { bulkDeleteTransactions } = vi.hoisted(() => ({
  bulkDeleteTransactions: vi.fn(),
}));

vi.mock('../../actions/bulk-delete-transactions', () => ({
  bulkDeleteTransactions,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const renderRows = () =>
  render(
    <BulkDeleteProvider visibleIdList={['a', 'b']} view={{ kind: 'byDate' }}>
      <TransactionSelectCheckbox id="a" label="Select a" />
      <TransactionSelectCheckbox id="b" label="Select b" />
    </BulkDeleteProvider>,
  );

const selectRow = (label: string): void => {
  fireEvent.click(screen.getByRole('checkbox', { name: label }));
};

describe('BulkDeleteProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the action bar once a row is selected', () => {
    renderRows();

    expect(screen.queryByText('deleteSelected')).toBeNull();

    selectRow('Select a');

    expect(screen.getByText('deleteSelected')).toBeDefined();
  });

  it('clears the selection after a fully successful delete', async () => {
    bulkDeleteTransactions.mockResolvedValue({
      status: 'success',
      deletedCount: 2,
      failedList: [],
    });
    renderRows();

    selectRow('Select a');
    selectRow('Select b');
    fireEvent.click(screen.getByText('deleteSelected'));
    fireEvent.click(screen.getByText('confirm'));

    await waitFor(() => {
      expect(screen.queryByText('deleteSelected')).toBeNull();
    });
    expect(bulkDeleteTransactions).toHaveBeenCalledWith({
      idList: ['a', 'b'],
      view: { kind: 'byDate' },
    });
  });

  it('keeps only the failed rows selected after a partial failure', async () => {
    bulkDeleteTransactions.mockResolvedValue({
      status: 'success',
      deletedCount: 1,
      failedList: [{ id: 'b', reason: 'NOT_FOUND' }],
    });
    renderRows();

    selectRow('Select a');
    selectRow('Select b');
    fireEvent.click(screen.getByText('deleteSelected'));
    fireEvent.click(screen.getByText('confirm'));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Select b' }).getAttribute('aria-checked')).toBe(
        'true',
      );
    });
    expect(screen.getByRole('checkbox', { name: 'Select a' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByText('partial')).toBeDefined();
  });
});
