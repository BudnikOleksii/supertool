import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TransactionEmptyState } from './TransactionEmptyState';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

describe('TransactionEmptyState', () => {
  it('renders the localized empty-state copy', async () => {
    const renderEmptyState = TransactionEmptyState;
    render(await renderEmptyState({}));

    expect(screen.getByText('empty.title')).toBeTruthy();
    expect(screen.getByText('empty.description')).toBeTruthy();
  });
});
