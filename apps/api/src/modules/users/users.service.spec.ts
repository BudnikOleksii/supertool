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

  it('passes non-name updates straight through to the repository', async () => {
    const inputPatch = { locale: 'uk', defaultCurrency: 'UAH' };
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann',
      firstName: 'Ann',
      lastName: null,
      role: 'user' as const,
      locale: 'uk',
      defaultCurrency: 'UAH',
    };
    const repository = { updateScoped: vi.fn().mockResolvedValue(expectedUser) };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.update('user-id', inputPatch)).resolves.toEqual(expectedUser);
    expect(repository.updateScoped).toHaveBeenCalledWith('user-id', inputPatch);
  });

  it('recomposes name from both parts when first and last name are updated', async () => {
    const inputPatch = { firstName: 'Ann', lastName: 'Smith' };
    const current = { id: 'user-id', firstName: 'Old', lastName: 'Name' };
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann Smith',
      firstName: 'Ann',
      lastName: 'Smith',
      role: 'user' as const,
      locale: 'en',
      defaultCurrency: null,
    };
    const repository = {
      findByIdScoped: vi.fn().mockResolvedValue(current),
      updateScoped: vi.fn().mockResolvedValue(expectedUser),
    };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.update('user-id', inputPatch)).resolves.toEqual(expectedUser);
    expect(repository.updateScoped).toHaveBeenCalledWith('user-id', {
      firstName: 'Ann',
      lastName: 'Smith',
      name: 'Ann Smith',
    });
  });

  it('merges a partial first-name PATCH over the stored last name before composing', async () => {
    const inputPatch = { firstName: 'Ann' };
    const current = { id: 'user-id', firstName: 'Old', lastName: 'Smith' };
    const repository = {
      findByIdScoped: vi.fn().mockResolvedValue(current),
      updateScoped: vi.fn().mockResolvedValue({ id: 'user-id', name: 'Ann Smith' }),
    };
    const service = new UsersService(repository as unknown as UsersRepository);

    await service.update('user-id', inputPatch);

    expect(repository.updateScoped).toHaveBeenCalledWith('user-id', {
      firstName: 'Ann',
      name: 'Ann Smith',
    });
  });

  it('throws NotFound when the scoped update affects no rows', async () => {
    const repository = { updateScoped: vi.fn().mockResolvedValue(undefined) };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.update('missing-id', { locale: 'uk' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFound when recomposing name but the current user is missing', async () => {
    const repository = {
      findByIdScoped: vi.fn().mockResolvedValue(undefined),
      updateScoped: vi.fn(),
    };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(service.update('missing-id', { firstName: 'Ghost' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.updateScoped).not.toHaveBeenCalled();
  });
});
