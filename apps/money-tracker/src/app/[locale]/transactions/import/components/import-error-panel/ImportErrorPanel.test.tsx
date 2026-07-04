import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ImportErrorPanel } from './ImportErrorPanel';

const KNOWN_ERROR_KEY_SET = new Set([
  'unsupportedFileType',
  'fileEmpty',
  'fileTooLarge',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'UNKNOWN',
]);

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, {
      has: (key: string) => KNOWN_ERROR_KEY_SET.has(key),
    }),
}));

describe('ImportErrorPanel', () => {
  it('renders the localized message for a known error code', () => {
    render(<ImportErrorPanel error={{ status: 'error', code: 'VALIDATION_ERROR' }} />);

    screen.getByText('VALIDATION_ERROR');
  });

  it('renders the localized fileTooLarge message for the 413 mapping', () => {
    render(<ImportErrorPanel error={{ status: 'error', code: 'fileTooLarge' }} />);

    screen.getByText('fileTooLarge');
  });

  it('falls back to UNKNOWN for an unmapped error code', () => {
    render(<ImportErrorPanel error={{ status: 'error', code: 'CONFLICT' }} />);

    screen.getByText('UNKNOWN');
    expect(screen.queryByText('CONFLICT')).toBeNull();
  });

  it('renders row errors verbatim under the localized heading', () => {
    render(
      <ImportErrorPanel
        error={{
          status: 'error',
          code: 'VALIDATION_ERROR',
          rowErrorList: ['Row 1: amount is invalid', 'Row 7: unknown category'],
        }}
      />,
    );

    screen.getByText('rowErrorsTitle');
    screen.getByText('Row 1: amount is invalid');
    screen.getByText('Row 7: unknown category');
  });

  it('renders no row-error block when the list is absent', () => {
    render(<ImportErrorPanel error={{ status: 'error', code: 'VALIDATION_ERROR' }} />);

    expect(screen.queryByText('rowErrorsTitle')).toBeNull();
  });
});
