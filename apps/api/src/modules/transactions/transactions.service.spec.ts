import { describe, expect, it, vi } from 'vitest';

import type { TransactionResponseDto } from './dtos/transaction-response.dto';
import type { TransactionsRepository } from './transactions.repository';

import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '../../shared/constants/pagination';
import { TransactionsService } from './transactions.service';

const buildTransaction = (id: string): TransactionResponseDto => ({
  id,
  date: '2025-02-03',
  type: 'expense',
  amount: '1234.56',
  currency: 'UAH',
  note: '',
  categoryId: 'category-id',
  categoryName: 'Food',
  categoryParentName: null,
  createdAt: '2025-02-03T00:00:00.000Z',
  updatedAt: '2025-02-03T00:00:00.000Z',
});

describe('TransactionsService', () => {
  it('applies default page and limit when the query omits them', async () => {
    const expectedData = [buildTransaction('transaction-1')];
    const findAllByUserId = vi.fn().mockResolvedValue({ data: expectedData, total: 1 });
    const repository = { findAllByUserId };
    const service = new TransactionsService(repository as unknown as TransactionsRepository);

    const actual = await service.findAll('user-id', {});

    expect(findAllByUserId).toHaveBeenCalledWith('user-id', {
      dateFrom: undefined,
      dateTo: undefined,
      page: FIRST_PAGE,
      limit: DEFAULT_PAGE_SIZE,
    });
    expect(actual).toEqual({
      data: expectedData,
      meta: { page: FIRST_PAGE, limit: DEFAULT_PAGE_SIZE, total: 1 },
    });
  });

  it('forwards explicit pagination and date window to the repository', async () => {
    const findAllByUserId = vi.fn().mockResolvedValue({ data: [], total: 0 });
    const repository = { findAllByUserId };
    const service = new TransactionsService(repository as unknown as TransactionsRepository);

    const inputQuery = { dateFrom: '2025-02-01', dateTo: '2025-02-28', page: 2, limit: 10 };
    const actual = await service.findAll('user-id', inputQuery);

    expect(findAllByUserId).toHaveBeenCalledWith('user-id', {
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      page: 2,
      limit: 10,
    });
    expect(actual.meta).toEqual({ page: 2, limit: 10, total: 0 });
  });
});
