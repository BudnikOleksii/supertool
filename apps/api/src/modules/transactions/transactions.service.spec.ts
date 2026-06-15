import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { CreateTransactionDto } from './dtos/create-transaction.dto';
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

  it('throws NotFoundException when the category does not belong to the user', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const repository = { findCategoryForUser, create };
    const service = new TransactionsService(repository as unknown as TransactionsRepository);

    const inputDto: CreateTransactionDto = {
      type: 'expense',
      amount: '12.50',
      currency: 'UAH',
      categoryId: 'missing-category',
      date: '2025-02-03',
    };

    await expect(service.create('user-id', inputDto)).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('throws UnprocessableEntityException when the category type differs from the transaction type', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'income' });
    const create = vi.fn();
    const repository = { findCategoryForUser, create };
    const service = new TransactionsService(repository as unknown as TransactionsRepository);

    const inputDto: CreateTransactionDto = {
      type: 'expense',
      amount: '12.50',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-02-03',
    };

    await expect(service.create('user-id', inputDto)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('forwards the session user id and defaults the note on the happy path', async () => {
    const expectedTransaction = buildTransaction('transaction-1');
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'expense' });
    const create = vi.fn().mockResolvedValue(expectedTransaction);
    const repository = { findCategoryForUser, create };
    const service = new TransactionsService(repository as unknown as TransactionsRepository);

    const inputDto: CreateTransactionDto = {
      type: 'expense',
      amount: '12.50',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-02-03',
    };

    const actual = await service.create('user-id', inputDto);

    expect(findCategoryForUser).toHaveBeenCalledWith('user-id', 'category-id');
    expect(create).toHaveBeenCalledWith({
      userId: 'user-id',
      categoryId: 'category-id',
      type: 'expense',
      amount: '12.50',
      currency: 'UAH',
      date: '2025-02-03',
      note: '',
    });
    expect(actual).toEqual(expectedTransaction);
  });
});
