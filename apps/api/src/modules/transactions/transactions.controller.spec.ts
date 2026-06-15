import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { auth } from '../../auth/auth';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

const createSession = (userId: string): UserSession<typeof auth> =>
  ({ user: { id: userId } }) as unknown as UserSession<typeof auth>;

describe('TransactionsController', () => {
  it('forwards the session user id and query to the service', async () => {
    const expectedResult = {
      data: [],
      meta: { page: 1, limit: 50, total: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: { findAll } }],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputQuery = { dateFrom: '2025-02-01', dateTo: '2025-02-28', page: 1, limit: 50 };

    await expect(controller.findAll(createSession('user-id'), inputQuery)).resolves.toEqual(
      expectedResult,
    );
    expect(findAll).toHaveBeenCalledWith('user-id', inputQuery);
  });

  it('forwards the session user id and body to the service on create', async () => {
    const expectedResult = {
      id: 'transaction-1',
      date: '2025-02-03',
      type: 'expense',
      amount: '12.50',
      currency: 'UAH',
      note: '',
      categoryId: 'category-id',
      categoryName: 'Food',
      categoryParentName: null,
      createdAt: '2025-02-03T00:00:00.000Z',
      updatedAt: '2025-02-03T00:00:00.000Z',
    };
    const create = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputDto = {
      type: 'expense' as const,
      amount: '12.50',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-02-03',
    };

    await expect(controller.create(createSession('user-id'), inputDto)).resolves.toEqual(
      expectedResult,
    );
    expect(create).toHaveBeenCalledWith('user-id', inputDto);
  });
});
