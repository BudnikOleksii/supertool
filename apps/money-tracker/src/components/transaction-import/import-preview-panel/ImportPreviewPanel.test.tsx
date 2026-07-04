import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionImportPreviewResponseDto } from '@supertool/shared/generated/types.gen';

import { ImportPreviewPanel } from './ImportPreviewPanel';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}));

const noop = () => undefined;

const PREVIEW: TransactionImportPreviewResponseDto = {
  totalRows: 10,
  newRows: 8,
  duplicateRows: 2,
  topLevelCategoriesToCreateList: ['Food', 'Travel'],
  childCategoriesToCreateList: ['Groceries'],
  nearDuplicateClusterList: [
    { normalizedKey: 'food', rawNameList: ['Food', 'food '], hasMixedScript: false },
  ],
};

describe('ImportPreviewPanel', () => {
  it('renders counts, category lists, near-duplicate warning, and the hint', () => {
    const expectedTextList = [
      'totalRows',
      'newRows',
      'duplicateRows',
      'topLevelCategoriesToCreate',
      'childCategoriesToCreate',
      'Food',
      'Travel',
      'Groceries',
      'nearDuplicateWarningTitle',
      'Food, food',
      'previewHint',
    ];

    render(<ImportPreviewPanel preview={PREVIEW} isPending={false} onExecute={noop} />);

    expectedTextList.forEach((expectedText) => {
      screen.getByText(expectedText);
    });
  });

  it('calls onExecute when the execute button is pressed', () => {
    const onExecute = vi.fn();
    render(<ImportPreviewPanel preview={PREVIEW} isPending={false} onExecute={onExecute} />);

    fireEvent.click(screen.getByRole('button', { name: 'executeButton' }));

    expect(onExecute).toHaveBeenCalled();
  });

  it('disables the execute button while pending', () => {
    render(<ImportPreviewPanel preview={PREVIEW} isPending onExecute={noop} />);

    expect(screen.getByRole('button', { name: 'importing' })).toHaveProperty('disabled', true);
  });

  it('disables the execute button when there are no new rows', () => {
    render(
      <ImportPreviewPanel
        preview={{ ...PREVIEW, newRows: 0 }}
        isPending={false}
        onExecute={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'executeButton' })).toHaveProperty('disabled', true);
  });

  it('omits empty category blocks', () => {
    render(
      <ImportPreviewPanel
        preview={{
          ...PREVIEW,
          topLevelCategoriesToCreateList: [],
          childCategoriesToCreateList: [],
          nearDuplicateClusterList: [],
        }}
        isPending={false}
        onExecute={noop}
      />,
    );

    expect(screen.queryByText('topLevelCategoriesToCreate')).toBeNull();
    expect(screen.queryByText('childCategoriesToCreate')).toBeNull();
    expect(screen.queryByText('nearDuplicateWarningTitle')).toBeNull();
  });
});
