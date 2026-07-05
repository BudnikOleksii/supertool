import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

import { formatAmount } from '../../../../../utils/format-amount';
import { TransactionCard } from './TransactionCard';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props} href="#test">
      {children}
    </a>
  ),
}));

vi.mock('../../../../../components/bulk-delete/TransactionSelectCheckbox', () => ({
  TransactionSelectCheckbox: ({ label }: { id: string; label: string }) => (
    <input type="checkbox" aria-label={label} />
  ),
}));

const LOCALE = 'en-US';
const PERIOD = '2025-02';
const PAGE = 1;

const buildTransaction = (overrides: Partial<TransactionResponseDto>): TransactionResponseDto => ({
  id: 'transaction-1',
  date: '2025-02-03',
  type: 'expense',
  amount: '1234.56',
  currency: 'USD',
  note: 'Groceries run',
  categoryId: 'category-1',
  categoryName: 'Groceries',
  categoryParentName: 'Food',
  createdAt: '2025-02-03T00:00:00.000Z',
  updatedAt: '2025-02-03T00:00:00.000Z',
  ...overrides,
});

const TYPE_LABEL = 'type.expense';

const renderCard = (transaction: TransactionResponseDto): void => {
  render(
    <ul>
      <TransactionCard
        transaction={transaction}
        locale={LOCALE}
        typeLabel={TYPE_LABEL}
        selectLabel="Select transaction"
        period={PERIOD}
        page={PAGE}
        sortBy="date"
        sortOrder="desc"
      />
    </ul>,
  );
};

describe('TransactionCard', () => {
  it('shows the amount, type badge, category and note for one transaction', () => {
    renderCard(buildTransaction({}));

    expect(screen.getByText(formatAmount('1234.56', 'USD', LOCALE))).toBeTruthy();
    expect(screen.getByText('Food / Groceries')).toBeTruthy();
    expect(screen.getByText(TYPE_LABEL)).toBeTruthy();
    expect(screen.getByText('Groceries run')).toBeTruthy();
  });

  it('renders a bare category name when the transaction has no parent category', () => {
    renderCard(buildTransaction({ categoryName: 'Salary', categoryParentName: null, note: '' }));

    expect(screen.getByText('Salary')).toBeTruthy();
  });

  it('omits the note line when the transaction has no note', () => {
    renderCard(buildTransaction({ note: '' }));

    expect(screen.queryByText('Groceries run')).toBeNull();
  });

  it('exposes always-visible duplicate, edit and delete actions (touch reachability)', () => {
    renderCard(buildTransaction({}));

    expect(screen.getByRole('link', { name: 'actions.copy' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'actions.edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'actions.delete' })).toBeTruthy();
  });
});
