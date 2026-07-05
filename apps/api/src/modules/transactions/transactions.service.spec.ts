import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '@supertool/shared/constants/pagination';
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@supertool/shared/constants/transaction-sort';

import type { CreateTransactionDto } from './dtos/create-transaction.dto';
import type { TransactionResponseDto } from './dtos/transaction-response.dto';
import type { UpdateTransactionDto } from './dtos/update-transaction.dto';
import type { TransactionsRepository } from './transactions.repository';

import { AnalyticsCacheService } from '../analytics/analytics-cache.service';
import { TransactionsService } from './transactions.service';

const buildAnalyticsCache = (): AnalyticsCacheService => new AnalyticsCacheService();

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
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const actual = await service.findAll('user-id', {});

    expect(findAllByUserId).toHaveBeenCalledWith('user-id', {
      dateFrom: undefined,
      dateTo: undefined,
      type: undefined,
      categoryId: undefined,
      sortBy: DEFAULT_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
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
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const inputQuery = { dateFrom: '2025-02-01', dateTo: '2025-02-28', page: 2, limit: 10 };
    const actual = await service.findAll('user-id', inputQuery);

    expect(findAllByUserId).toHaveBeenCalledWith('user-id', {
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: undefined,
      categoryId: undefined,
      sortBy: DEFAULT_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
      page: 2,
      limit: 10,
    });
    expect(actual.meta).toEqual({ page: 2, limit: 10, total: 0 });
  });

  it('forwards supplied filters and sort to the repository', async () => {
    const findAllByUserId = vi.fn().mockResolvedValue({ data: [], total: 0 });
    const repository = { findAllByUserId };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const inputQuery = {
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: 'expense' as const,
      categoryId: 'category-id',
      sortBy: 'amount' as const,
      sortOrder: 'asc' as const,
      page: 1,
      limit: 50,
    };
    await service.findAll('user-id', inputQuery);

    expect(findAllByUserId).toHaveBeenCalledWith('user-id', {
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: 'expense',
      categoryId: 'category-id',
      sortBy: 'amount',
      sortOrder: 'asc',
      page: 1,
      limit: 50,
    });
  });

  it('forwards the search term to the repository', async () => {
    const findAllByUserId = vi.fn().mockResolvedValue({ data: [], total: 0 });
    const repository = { findAllByUserId };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    await service.findAll('user-id', { search: 'coffee' });

    expect(findAllByUserId).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({ search: 'coffee' }),
    );
  });

  it('throws NotFoundException when the category does not belong to the user', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const repository = { findCategoryForUser, create };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

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
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

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
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

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

describe('TransactionsService findOne/update/delete', () => {
  it('returns the transaction on findOne when it exists for the user', async () => {
    const expectedTransaction = buildTransaction('transaction-1');
    const findOneByUserIdAndId = vi.fn().mockResolvedValue(expectedTransaction);
    const repository = { findOneByUserIdAndId };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const actual = await service.findOne('user-id', 'transaction-1');

    expect(findOneByUserIdAndId).toHaveBeenCalledWith('user-id', 'transaction-1');
    expect(actual).toEqual(expectedTransaction);
  });

  it('throws NotFoundException on findOne when the transaction is not found for the user', async () => {
    const findOneByUserIdAndId = vi.fn().mockResolvedValue(null);
    const repository = { findOneByUserIdAndId };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    await expect(service.findOne('user-id', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates the transaction after validating the category type', async () => {
    const expectedTransaction = buildTransaction('transaction-1');
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'expense' });
    const updateScoped = vi.fn().mockResolvedValue(expectedTransaction);
    const repository = { findCategoryForUser, updateScoped };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const inputDto: UpdateTransactionDto = {
      type: 'expense',
      amount: '99.99',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-03-10',
    };

    const actual = await service.update('user-id', 'transaction-1', inputDto);

    expect(findCategoryForUser).toHaveBeenCalledWith('user-id', 'category-id');
    expect(updateScoped).toHaveBeenCalledWith('user-id', 'transaction-1', {
      categoryId: 'category-id',
      type: 'expense',
      amount: '99.99',
      currency: 'UAH',
      date: '2025-03-10',
      note: '',
    });
    expect(actual).toEqual(expectedTransaction);
  });

  it('throws UnprocessableEntityException on update when the category type differs', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'income' });
    const updateScoped = vi.fn();
    const repository = { findCategoryForUser, updateScoped };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const inputDto: UpdateTransactionDto = {
      type: 'expense',
      amount: '99.99',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-03-10',
    };

    await expect(service.update('user-id', 'transaction-1', inputDto)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(updateScoped).not.toHaveBeenCalled();
  });

  it('throws NotFoundException on update when no scoped row matched', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'expense' });
    const updateScoped = vi.fn().mockResolvedValue(null);
    const repository = { findCategoryForUser, updateScoped };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    const inputDto: UpdateTransactionDto = {
      type: 'expense',
      amount: '99.99',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-03-10',
    };

    await expect(service.update('user-id', 'missing', inputDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes the transaction when a scoped row was removed', async () => {
    const deleteScoped = vi.fn().mockResolvedValue(true);
    const repository = { deleteScoped };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    await expect(service.delete('user-id', 'transaction-1')).resolves.toBeUndefined();
    expect(deleteScoped).toHaveBeenCalledWith('user-id', 'transaction-1');
  });

  it('throws NotFoundException on delete when nothing was removed', async () => {
    const deleteScoped = vi.fn().mockResolvedValue(false);
    const repository = { deleteScoped };
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      buildAnalyticsCache(),
    );

    await expect(service.delete('user-id', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TransactionsService analytics-cache invalidation', () => {
  it('invalidates the acting user cache after a successful create', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'expense' });
    const create = vi.fn().mockResolvedValue(buildTransaction('transaction-1'));
    const repository = { findCategoryForUser, create };
    const analyticsCache = buildAnalyticsCache();
    const invalidateUser = vi.spyOn(analyticsCache, 'invalidateUser');
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      analyticsCache,
    );

    await service.create('user-id', {
      type: 'expense',
      amount: '12.50',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-02-03',
    });

    expect(invalidateUser).toHaveBeenCalledWith('user-id');
  });

  it('does not invalidate when a create fails validation', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const repository = { findCategoryForUser, create };
    const analyticsCache = buildAnalyticsCache();
    const invalidateUser = vi.spyOn(analyticsCache, 'invalidateUser');
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      analyticsCache,
    );

    await expect(
      service.create('user-id', {
        type: 'expense',
        amount: '12.50',
        currency: 'UAH',
        categoryId: 'missing-category',
        date: '2025-02-03',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(invalidateUser).not.toHaveBeenCalled();
  });

  it('invalidates the acting user cache after a successful update', async () => {
    const findCategoryForUser = vi.fn().mockResolvedValue({ id: 'category-id', type: 'expense' });
    const updateScoped = vi.fn().mockResolvedValue(buildTransaction('transaction-1'));
    const repository = { findCategoryForUser, updateScoped };
    const analyticsCache = buildAnalyticsCache();
    const invalidateUser = vi.spyOn(analyticsCache, 'invalidateUser');
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      analyticsCache,
    );

    await service.update('user-id', 'transaction-1', {
      type: 'expense',
      amount: '99.99',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-03-10',
    });

    expect(invalidateUser).toHaveBeenCalledWith('user-id');
  });

  it('invalidates the acting user cache after a successful delete', async () => {
    const deleteScoped = vi.fn().mockResolvedValue(true);
    const repository = { deleteScoped };
    const analyticsCache = buildAnalyticsCache();
    const invalidateUser = vi.spyOn(analyticsCache, 'invalidateUser');
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      analyticsCache,
    );

    await service.delete('user-id', 'transaction-1');

    expect(invalidateUser).toHaveBeenCalledWith('user-id');
  });

  it('invalidates the acting user cache after a bulk delete', async () => {
    const deleteManyScoped = vi.fn().mockResolvedValue(['transaction-1']);
    const repository = { deleteManyScoped };
    const analyticsCache = buildAnalyticsCache();
    const invalidateUser = vi.spyOn(analyticsCache, 'invalidateUser');
    const service = new TransactionsService(
      repository as unknown as TransactionsRepository,
      analyticsCache,
    );

    await service.bulkDelete('user-id', ['transaction-1']);

    expect(invalidateUser).toHaveBeenCalledWith('user-id');
  });
});
