import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { auth } from '../../auth/auth';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const createSession = (userId: string): UserSession<typeof auth> =>
  ({ user: { id: userId } }) as unknown as UserSession<typeof auth>;

describe('UsersController', () => {
  it('returns the current user from the service using the session user id', async () => {
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann',
      role: 'user' as const,
      locale: 'en',
      defaultCurrency: null,
    };
    const getById = vi.fn().mockResolvedValue(expectedUser);
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { getById } }],
    }).compile();

    const controller = moduleRef.get(UsersController);

    await expect(controller.me(createSession('user-id'))).resolves.toEqual(expectedUser);
    expect(getById).toHaveBeenCalledWith('user-id');
  });

  it('updates the current user via the service using the session user id and body', async () => {
    const inputDto = {
      firstName: 'Ann',
      lastName: 'Updated',
      locale: 'uk',
      defaultCurrency: 'UAH',
    };
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann Updated',
      firstName: 'Ann',
      lastName: 'Updated',
      role: 'user' as const,
      locale: 'uk',
      defaultCurrency: 'UAH',
    };
    const update = vi.fn().mockResolvedValue(expectedUser);
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { update } }],
    }).compile();

    const controller = moduleRef.get(UsersController);

    await expect(controller.updateMe(createSession('user-id'), inputDto)).resolves.toEqual(
      expectedUser,
    );
    expect(update).toHaveBeenCalledWith('user-id', inputDto);
  });

  it('deletes the current account via the service using the session user id', async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { deleteAccount } }],
    }).compile();

    const controller = moduleRef.get(UsersController);

    await expect(controller.deleteMe(createSession('user-id'))).resolves.toBeUndefined();
    expect(deleteAccount).toHaveBeenCalledWith('user-id');
  });
});
