import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoriesStep } from './CategoriesStep';

const {
  assignDefaultCategories,
  completeOnboarding,
  previewTransactionImport,
  executeTransactionImport,
  replace,
} = vi.hoisted(() => ({
  assignDefaultCategories: vi.fn(),
  completeOnboarding: vi.fn(),
  previewTransactionImport: vi.fn(),
  executeTransactionImport: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('../../../../../actions/assign-default-categories', () => ({ assignDefaultCategories }));
vi.mock('../../../../../actions/complete-onboarding', () => ({ completeOnboarding }));
vi.mock('../../../../../actions/preview-transaction-import', () => ({
  previewTransactionImport,
}));
vi.mock('../../../../../actions/execute-transaction-import', () => ({
  executeTransactionImport,
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
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

describe('CategoriesStep', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('assigns default categories and shows the created counts with a continue button', async () => {
    assignDefaultCategories.mockResolvedValue({
      status: 'success',
      result: { topLevelCreated: 18, childrenCreated: 39 },
    });
    render(<CategoriesStep />);

    fireEvent.click(screen.getByRole('button', { name: 'useDefaultsButton' }));

    await screen.findByText('defaultsResultTitle');
    screen.getByText('defaultsResultTopLevel');
    screen.getByRole('button', { name: 'continueButton' });
  });

  it('completes onboarding and lands on the dashboard when continuing', async () => {
    assignDefaultCategories.mockResolvedValue({
      status: 'success',
      result: { topLevelCreated: 18, childrenCreated: 39 },
    });
    completeOnboarding.mockResolvedValue({ status: 'success' });
    render(<CategoriesStep />);

    fireEvent.click(screen.getByRole('button', { name: 'useDefaultsButton' }));

    const continueButton = await screen.findByRole('button', { name: 'continueButton' });
    await waitFor(() => {
      expect(continueButton).toHaveProperty('disabled', false);
    });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(completeOnboarding).toHaveBeenCalled();
    });
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('skips the optional step straight to the dashboard', async () => {
    completeOnboarding.mockResolvedValue({ status: 'success' });
    render(<CategoriesStep />);

    fireEvent.click(screen.getByRole('button', { name: 'skipButton' }));

    await waitFor(() => {
      expect(completeOnboarding).toHaveBeenCalled();
    });
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('renders an error when assigning defaults fails', async () => {
    assignDefaultCategories.mockResolvedValue({ status: 'error', code: 'UNAUTHORIZED' });
    render(<CategoriesStep />);

    fireEvent.click(screen.getByRole('button', { name: 'useDefaultsButton' }));

    await screen.findByText('UNAUTHORIZED');
    expect(screen.queryByText('defaultsResultTitle')).toBeNull();
  });

  it('falls back to UNKNOWN when the defaults action rejects', async () => {
    assignDefaultCategories.mockRejectedValue(new Error('network'));
    render(<CategoriesStep />);

    fireEvent.click(screen.getByRole('button', { name: 'useDefaultsButton' }));

    await screen.findByText('UNKNOWN');
  });

  it('runs the reused import flow to a compact result with a continue button', async () => {
    previewTransactionImport.mockResolvedValue({ status: 'success', preview: PREVIEW });
    executeTransactionImport.mockResolvedValue({ status: 'success', report: REPORT });
    render(<CategoriesStep />);

    selectValidFile();
    fireEvent.click(screen.getByRole('button', { name: 'previewButton' }));

    fireEvent.click(await screen.findByRole('button', { name: 'executeButton' }));

    await screen.findByText('importResultTitle');
    screen.getByText('importResultInserted');
    screen.getByRole('button', { name: 'continueButton' });
  });
});
