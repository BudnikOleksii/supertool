import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionImportResponseDto } from '@supertool/shared/generated/types.gen';

import { ImportResultPanel } from './ImportResultPanel';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const REPORT: TransactionImportResponseDto = {
  inserted: 12,
  skippedDuplicates: 3,
  topLevelCategoriesCreated: 2,
  childCategoriesCreated: 4,
  nearDuplicateClusterList: [],
};

describe('ImportResultPanel', () => {
  it('renders the report counts', () => {
    render(<ImportResultPanel report={REPORT} />);

    screen.getByText('resultTitle');
    screen.getByText('resultInserted');
    screen.getByText('resultSkippedDuplicates');
    screen.getByText('resultTopLevelCategoriesCreated');
    screen.getByText('resultChildCategoriesCreated');
  });

  it('links to the transactions list and the dashboard', () => {
    render(<ImportResultPanel report={REPORT} />);

    expect(screen.getByRole('link', { name: 'goToTransactions' }).getAttribute('href')).toBe(
      '/transactions',
    );
    expect(screen.getByRole('link', { name: 'goToDashboard' }).getAttribute('href')).toBe(
      '/dashboard',
    );
  });

  it('renders near-duplicate warnings from the report', () => {
    render(
      <ImportResultPanel
        report={{
          ...REPORT,
          nearDuplicateClusterList: [
            { normalizedKey: 'cafe', rawNameList: ['Cafe', 'Café'], hasMixedScript: false },
          ],
        }}
      />,
    );

    screen.getByText('nearDuplicateWarningTitle');
    screen.getByText('Cafe, Café');
  });
});
