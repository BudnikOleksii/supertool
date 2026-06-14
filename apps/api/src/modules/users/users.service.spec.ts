import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { UsersRepository } from './users.repository';

import { UsersService } from './users.service';

describe('UsersService', () => {
  it('returns the scoped user when the repository finds one', async () => {
    const expectedUser = { id: 'user-id', email: 'a@b.com', name: 'Ann', role: 'user' as const };
    const repository = { findByIdScoped: vi.fn().mockResolvedValue(expectedUser) };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.getById('user-id')).resolves.toEqual(expectedUser);
    expect(repository.findByIdScoped).toHaveBeenCalledWith('user-id');
  });

  it('throws NotFound when the repository returns nothing', async () => {
    const repository = { findByIdScoped: vi.fn().mockResolvedValue(undefined) };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.getById('missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
