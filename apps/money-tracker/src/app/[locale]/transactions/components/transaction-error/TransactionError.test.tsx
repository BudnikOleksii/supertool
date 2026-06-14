import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TransactionError } from './TransactionError';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

describe('TransactionError', () => {
  it('renders the localized error-state copy', async () => {
    const renderError = TransactionError;
    render(await renderError({}));

    expect(screen.getByText('error.title')).toBeTruthy();
    expect(screen.getByText('error.description')).toBeTruthy();
  });
});
