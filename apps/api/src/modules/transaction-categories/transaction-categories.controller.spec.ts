import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { auth } from '../../auth/auth';

import { TransactionCategoriesController } from './transaction-categories.controller';
import { TransactionCategoriesService } from './transaction-categories.service';

const createSession = (userId: string): UserSession<typeof auth> =>
  ({ user: { id: userId } }) as unknown as UserSession<typeof auth>;

const buildController = (service: Partial<TransactionCategoriesService>) =>
  Test.createTestingModule({
    controllers: [TransactionCategoriesController],
    providers: [{ provide: TransactionCategoriesService, useValue: service }],
  })
    .compile()
    .then((moduleRef) => moduleRef.get(TransactionCategoriesController));

describe('TransactionCategoriesController', () => {
  it('lists categories for the session user', async () => {
    const expectedList = [{ id: 'c1', name: 'Food', type: 'expense' }];
    const findAll = vi.fn().mockResolvedValue(expectedList);
    const controller = await buildController({ findAll });

    await expect(controller.findAll(createSession('user-id'))).resolves.toEqual(expectedList);
    expect(findAll).toHaveBeenCalledWith('user-id');
  });

  it('creates a category with the session user id and body', async () => {
    const inputDto = { name: 'Food', type: 'expense' as const };
    const expectedCategory = { id: 'c1', name: 'Food', type: 'expense' };
    const create = vi.fn().mockResolvedValue(expectedCategory);
    const controller = await buildController({ create });

    await expect(controller.create(createSession('user-id'), inputDto)).resolves.toEqual(
      expectedCategory,
    );
    expect(create).toHaveBeenCalledWith('user-id', inputDto);
  });

  it('updates a category scoped to the session user', async () => {
    const inputDto = { name: 'Groceries' };
    const expectedCategory = { id: 'c1', name: 'Groceries', type: 'expense' };
    const update = vi.fn().mockResolvedValue(expectedCategory);
    const controller = await buildController({ update });

    await expect(controller.update(createSession('user-id'), 'c1', inputDto)).resolves.toEqual(
      expectedCategory,
    );
    expect(update).toHaveBeenCalledWith('user-id', 'c1', inputDto);
  });

  it('deletes a category scoped to the session user with the reassignment body', async () => {
    const inputDto = { reassignTransactionsToCategoryId: 'c2' };
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const controller = await buildController({ delete: deleteSpy });

    await expect(
      controller.remove(createSession('user-id'), 'c1', inputDto),
    ).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith('user-id', 'c1', inputDto);
  });
});
