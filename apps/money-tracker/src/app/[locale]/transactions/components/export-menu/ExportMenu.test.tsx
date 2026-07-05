import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';

import type { ExportFilterQuery } from './types';

import { ExportMenu } from './ExportMenu';

const { exportTransactions, downloadBlob, translate } = vi.hoisted(() => ({
  exportTransactions: vi.fn(),
  downloadBlob: vi.fn(),
  translate: Object.assign((key: string): string => key, { has: (): boolean => true }),
}));

vi.mock('../../../../../actions/export-transactions', () => ({ exportTransactions }));

vi.mock('./download-blob', () => ({ downloadBlob }));

vi.mock('next-intl', () => ({
  useTranslations: () => translate,
}));

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

const FILTERS: ExportFilterQuery = {
  dateFrom: '2025-02-01',
  dateTo: '2025-02-28',
  sortBy: 'date',
  sortOrder: 'desc',
};

const renderMenu = () =>
  render(<ExportMenu namespace={I18N_NAMESPACE.transactionsPage} filters={FILTERS} />);

const openMenu = () => {
  fireEvent.keyDown(screen.getByRole('button', { name: /trigger/u }), { key: 'Enter' });
};

describe('ExportMenu', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the export trigger', () => {
    renderMenu();

    expect(screen.getByRole('button', { name: /trigger/u })).toBeDefined();
  });

  it('offers CSV and JSON items when opened', () => {
    renderMenu();
    openMenu();

    expect(screen.getByRole('menuitem', { name: 'csv' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'json' })).toBeDefined();
  });

  it('downloads the current view when a format is chosen', async () => {
    exportTransactions.mockResolvedValue({
      status: 'success',
      content: 'csv-body',
      fileName: 'transactions.csv',
      mimeType: 'text/csv',
    });

    renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'csv' }));

    await waitFor(() => {
      expect(exportTransactions).toHaveBeenCalledWith({ ...FILTERS, format: 'csv' });
    });
    expect(downloadBlob).toHaveBeenCalledWith({
      content: 'csv-body',
      fileName: 'transactions.csv',
      mimeType: 'text/csv',
    });
  });

  it('shows a localized alert and does not download on error', async () => {
    exportTransactions.mockResolvedValue({ status: 'error', code: 'UNKNOWN' });

    renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'json' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
