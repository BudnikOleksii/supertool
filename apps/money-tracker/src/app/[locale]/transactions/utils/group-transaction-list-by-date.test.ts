import { describe, expect, it } from 'vitest';

import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

import { groupTransactionListByDate } from './group-transaction-list-by-date';

const SINGLE_ITEM_LENGTH = 1;

const buildTransaction = (id: string, date: string): TransactionResponseDto => ({
  id,
  date,
  type: 'expense',
  amount: '10.00',
  currency: 'USD',
  note: '',
  categoryId: 'category-1',
  categoryName: 'Groceries',
  categoryParentName: null,
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: `${date}T00:00:00.000Z`,
});

describe('groupTransactionListByDate', () => {
  it('groups consecutive transactions that share the same date', () => {
    const sameDayList = [buildTransaction('a', '2025-02-03'), buildTransaction('b', '2025-02-03')];
    const otherDayList = [buildTransaction('c', '2025-02-02')];

    const groupList = groupTransactionListByDate([...sameDayList, ...otherDayList]);
    const [firstGroup, secondGroup] = groupList;

    expect(groupList).toHaveLength([sameDayList, otherDayList].length);
    expect(firstGroup?.date).toBe('2025-02-03');
    expect(firstGroup?.transactionList.map((transaction) => transaction.id)).toEqual(
      sameDayList.map((transaction) => transaction.id),
    );
    expect(secondGroup?.transactionList).toHaveLength(otherDayList.length);
  });

  it('starts a new group when the same date reappears non-consecutively', () => {
    const transactionList = [
      buildTransaction('a', '2025-02-03'),
      buildTransaction('b', '2025-02-02'),
      buildTransaction('c', '2025-02-03'),
    ];

    expect(groupTransactionListByDate(transactionList)).toHaveLength(transactionList.length);
  });

  it('keeps a lone transaction in a single group', () => {
    expect(groupTransactionListByDate([buildTransaction('a', '2025-02-03')])).toHaveLength(
      SINGLE_ITEM_LENGTH,
    );
  });

  it('returns an empty array for no transactions', () => {
    expect(groupTransactionListByDate([])).toEqual([]);
  });
});
