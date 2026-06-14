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
    const expectedUser = { id: 'user-id', email: 'a@b.com', name: 'Ann', role: 'user' as const };
    const getById = vi.fn().mockResolvedValue(expectedUser);
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { getById } }],
    }).compile();

    const controller = moduleRef.get(UsersController);

    await expect(controller.me(createSession('user-id'))).resolves.toEqual(expectedUser);
    expect(getById).toHaveBeenCalledWith('user-id');
  });
});
