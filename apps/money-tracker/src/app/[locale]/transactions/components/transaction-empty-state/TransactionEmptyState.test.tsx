import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TransactionEmptyState } from './TransactionEmptyState';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
}));

const PERIOD = '2025-03';

describe('TransactionEmptyState', () => {
  it('renders the empty-month copy without a clear affordance', async () => {
    const renderEmptyState = TransactionEmptyState;
    render(await renderEmptyState({ variant: 'emptyMonth', period: PERIOD }));

    expect(screen.getByText('empty.title')).toBeTruthy();
    expect(screen.getByText('empty.description')).toBeTruthy();
    expect(screen.queryByText('noMatches.clear')).toBeNull();
  });

  it('renders the no-matches copy with a clear affordance', async () => {
    const renderEmptyState = TransactionEmptyState;
    render(await renderEmptyState({ variant: 'noMatches', period: PERIOD }));

    expect(screen.getByText('noMatches.title')).toBeTruthy();
    expect(screen.getByText('noMatches.description')).toBeTruthy();
    expect(screen.getByText('noMatches.clear')).toBeTruthy();
  });

  it('renders the no-search-matches copy with a clear-search affordance', async () => {
    const renderEmptyState = TransactionEmptyState;
    render(await renderEmptyState({ variant: 'noSearchMatches', period: PERIOD }));

    expect(screen.getByText('noSearchMatches.title')).toBeTruthy();
    expect(screen.getByText('noSearchMatches.description')).toBeTruthy();
    expect(screen.getByText('noSearchMatches.clear')).toBeTruthy();
  });
});
