import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImportPageContent } from './ImportPageContent';

const { previewTransactionImport, executeTransactionImport } = vi.hoisted(() => ({
  previewTransactionImport: vi.fn(),
  executeTransactionImport: vi.fn(),
}));

vi.mock('../../../../../../actions/preview-transaction-import', () => ({
  previewTransactionImport,
}));

vi.mock('../../../../../../actions/execute-transaction-import', () => ({
  executeTransactionImport,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const PREVIEW = {
  totalRows: 2,
  newRows: 2,
  duplicateRows: 0,
  topLevelCategoriesToCreateList: ['Food'],
  childCategoriesToCreateList: [],
  nearDuplicateClusterList: [],
};

const REPORT = {
  inserted: 2,
  skippedDuplicates: 0,
  topLevelCategoriesCreated: 1,
  childCategoriesCreated: 0,
  nearDuplicateClusterList: [],
};

const selectValidFile = (): void => {
  fireEvent.change(screen.getByLabelText('dropzoneLabel'), {
    target: { files: [new File(['[]'], 'transactions.json')] },
  });
};

describe('ImportPageContent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows only the dropzone before a file is selected', () => {
    render(<ImportPageContent />);

    screen.getByText('dropzoneInstruction');
    expect(screen.queryByRole('button', { name: 'previewButton' })).toBeNull();
  });

  it('rejects an unsupported file with a localized pre-check error', () => {
    render(<ImportPageContent />);

    fireEvent.change(screen.getByLabelText('dropzoneLabel'), {
      target: { files: [new File(['x'], 'notes.txt')] },
    });

    screen.getByText('unsupportedFileType');
    expect(screen.queryByRole('button', { name: 'previewButton' })).toBeNull();
  });

  it('runs the select, preview, execute flow through to the result panel', async () => {
    previewTransactionImport.mockResolvedValue({ status: 'success', preview: PREVIEW });
    executeTransactionImport.mockResolvedValue({ status: 'success', report: REPORT });
    render(<ImportPageContent />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));

    fireEvent.click(await screen.findByRole('button', { name: 'executeButton' }));
    await screen.findByText('resultTitle');

    expect(executeTransactionImport).toHaveBeenCalled();
    expect(screen.queryByText('dropzoneInstruction')).toBeNull();
  });

  it('renders preview errors with row details and allows retry', async () => {
    previewTransactionImport.mockResolvedValue({
      status: 'error',
      code: 'VALIDATION_ERROR',
      rowErrorList: ['Row 1: amount is invalid'],
    });
    render(<ImportPageContent />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));

    await screen.findByText('rowErrorsTitle');
    screen.getByText('Row 1: amount is invalid');
    await screen.findByRole('button', { name: 'previewButton' });
  });

  it('renders the unknown error panel and allows retry when the preview action rejects', async () => {
    previewTransactionImport.mockRejectedValue(new Error('network failure'));
    render(<ImportPageContent />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));

    await screen.findByText('UNKNOWN');
    await screen.findByRole('button', { name: 'previewButton' });
  });

  it('renders the unknown error panel and allows retry when the execute action rejects', async () => {
    previewTransactionImport.mockResolvedValue({ status: 'success', preview: PREVIEW });
    executeTransactionImport.mockRejectedValue(new Error('network failure'));
    render(<ImportPageContent />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));

    fireEvent.click(await screen.findByRole('button', { name: 'executeButton' }));

    await screen.findByText('UNKNOWN');
    screen.getByText('previewTitle');
    await screen.findByRole('button', { name: 'executeButton' });
  });

  it('renders an execute error while keeping the preview visible', async () => {
    previewTransactionImport.mockResolvedValue({ status: 'success', preview: PREVIEW });
    executeTransactionImport.mockResolvedValue({ status: 'error', code: 'UNAUTHORIZED' });
    render(<ImportPageContent />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));

    fireEvent.click(await screen.findByRole('button', { name: 'executeButton' }));

    await screen.findByText('UNAUTHORIZED');
    screen.getByText('previewTitle');
  });

  it('clears preview state when the file is removed', async () => {
    previewTransactionImport.mockResolvedValue({ status: 'success', preview: PREVIEW });
    render(<ImportPageContent />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));
    await screen.findByRole('button', { name: 'executeButton' });

    fireEvent.click(screen.getByRole('button', { name: 'clearFile' }));

    expect(screen.queryByText('previewTitle')).toBeNull();
    screen.getByText('dropzoneInstruction');
  });
});
