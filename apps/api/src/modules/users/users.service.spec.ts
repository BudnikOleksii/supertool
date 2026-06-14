import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { UsersRepository } from './users.repository';

import { UsersService } from './users.service';

describe('UsersService', () => {
  it('returns the scoped user when the repository finds one', async () => {
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann',
      role: 'user' as const,
      locale: 'en',
      defaultCurrency: null,
    };
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

  it('returns the updated user from the repository scoped to the user id', async () => {
    const inputPatch = { name: 'Ann Updated', locale: 'uk', defaultCurrency: 'UAH' };
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann Updated',
      role: 'user' as const,
      locale: 'uk',
      defaultCurrency: 'UAH',
    };
    const repository = { updateScoped: vi.fn().mockResolvedValue(expectedUser) };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.update('user-id', inputPatch)).resolves.toEqual(expectedUser);
    expect(repository.updateScoped).toHaveBeenCalledWith('user-id', inputPatch);
  });

  it('throws NotFound when the scoped update affects no rows', async () => {
    const repository = { updateScoped: vi.fn().mockResolvedValue(undefined) };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.update('missing-id', { name: 'Ghost' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
