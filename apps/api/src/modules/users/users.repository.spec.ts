import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../database/database.types';

import { UsersRepository } from './users.repository';

const createDbDouble = (returnedRowList: unknown[]) => {
  const returning = vi.fn().mockResolvedValue(returnedRowList);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });

  return { db: { update } as unknown as Database, set };
};

describe('UsersRepository', () => {
  it('updateScoped sets only the defined patch fields plus updatedAt', async () => {
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann',
      role: 'user',
      locale: 'uk',
      defaultCurrency: null,
    };
    const { db, set } = createDbDouble([expectedUser]);
    const repository = new UsersRepository(db);

    const actual = await repository.updateScoped('user-id', { locale: 'uk' });

    expect(actual).toEqual(expectedUser);
    expect(set).toHaveBeenCalledWith({ locale: 'uk', updatedAt: expect.any(Date) });
  });

  it('updateScoped maps the onboardingCompleted field when provided', async () => {
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann',
      role: 'user',
      locale: 'en',
      defaultCurrency: null,
      onboardingCompleted: true,
    };
    const { db, set } = createDbDouble([expectedUser]);
    const repository = new UsersRepository(db);

    const actual = await repository.updateScoped('user-id', { onboardingCompleted: true });

    expect(actual).toEqual(expectedUser);
    expect(set).toHaveBeenCalledWith({ onboardingCompleted: true, updatedAt: expect.any(Date) });
  });

  it('updateScoped maps the firstName, lastName and composed name fields when provided', async () => {
    const expectedUser = {
      id: 'user-id',
      email: 'a@b.com',
      name: 'Ann Smith',
      firstName: 'Ann',
      lastName: 'Smith',
      role: 'user',
      locale: 'en',
      defaultCurrency: null,
    };
    const { db, set } = createDbDouble([expectedUser]);
    const repository = new UsersRepository(db);

    const actual = await repository.updateScoped('user-id', {
      firstName: 'Ann',
      lastName: 'Smith',
      name: 'Ann Smith',
    });

    expect(actual).toEqual(expectedUser);
    expect(set).toHaveBeenCalledWith({
      firstName: 'Ann',
      lastName: 'Smith',
      name: 'Ann Smith',
      updatedAt: expect.any(Date),
    });
  });

  it('updateScoped returns undefined when no row matches the scoped user', async () => {
    const { db } = createDbDouble([]);
    const repository = new UsersRepository(db);

    await expect(repository.updateScoped('missing-id', { locale: 'en' })).resolves.toBeUndefined();
  });
});
