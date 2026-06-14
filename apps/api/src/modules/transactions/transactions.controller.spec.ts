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
});
