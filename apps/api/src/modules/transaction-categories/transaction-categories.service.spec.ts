import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionCategoriesRepository } from './transaction-categories.repository';

import { TransactionCategoriesService } from './transaction-categories.service';

const FAKE_TX = { tx: true };

interface MockRepository {
  runInTransaction: ReturnType<typeof vi.fn>;
  findAllByUserId: ReturnType<typeof vi.fn>;
  findByIdScoped: ReturnType<typeof vi.fn>;
  existsByNameTypeAndParent: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  isDescendantOf: ReturnType<typeof vi.fn>;
  hasTransactions: ReturnType<typeof vi.fn>;
  hasChildren: ReturnType<typeof vi.fn>;
  reassignTransactions: ReturnType<typeof vi.fn>;
  reassignChildren: ReturnType<typeof vi.fn>;
  deleteScoped: ReturnType<typeof vi.fn>;
}

const buildRepository = (overrides: Partial<MockRepository> = {}): MockRepository => ({
  runInTransaction: vi.fn((callback: (tx: unknown) => unknown) => callback(FAKE_TX)),
  findAllByUserId: vi.fn(),
  findByIdScoped: vi.fn(),
  existsByNameTypeAndParent: vi.fn().mockResolvedValue(false),
  create: vi.fn(),
  update: vi.fn(),
  isDescendantOf: vi.fn().mockResolvedValue(false),
  hasTransactions: vi.fn().mockResolvedValue(false),
  hasChildren: vi.fn().mockResolvedValue(false),
  reassignTransactions: vi.fn().mockResolvedValue(undefined),
  reassignChildren: vi.fn().mockResolvedValue(undefined),
  deleteScoped: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const buildService = (repository: MockRepository): TransactionCategoriesService =>
  new TransactionCategoriesService(repository as unknown as TransactionCategoriesRepository);

const buildCategory = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Food',
  type: 'expense',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('TransactionCategoriesService.create', () => {
  it('rejects a parent whose type differs with 422', async () => {
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(buildCategory({ id: 'p1', type: 'income' })),
    });
    const service = buildService(repository);

    await expect(
      service.create('user-id', { name: 'Salary', type: 'expense', parentId: 'p1' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('throws 404 when the parent does not exist', async () => {
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(undefined),
    });
    const service = buildService(repository);

    await expect(
      service.create('user-id', { name: 'Food', type: 'expense', parentId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate with 409 before inserting', async () => {
    const repository = buildRepository({
      existsByNameTypeAndParent: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(
      service.create('user-id', { name: 'Food', type: 'expense' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates a top-level category when no duplicate exists', async () => {
    const expectedCategory = buildCategory();
    const repository = buildRepository({
      create: vi.fn().mockResolvedValue(expectedCategory),
    });
    const service = buildService(repository);

    await expect(service.create('user-id', { name: 'Food', type: 'expense' })).resolves.toEqual(
      expectedCategory,
    );
    expect(repository.create).toHaveBeenCalledWith(
      { userId: 'user-id', name: 'Food', type: 'expense', parentId: null },
      FAKE_TX,
    );
  });
});

describe('TransactionCategoriesService.update', () => {
  it('rejects an empty patch with 400', async () => {
    const repository = buildRepository();
    const service = buildService(repository);

    await expect(service.update('user-id', 'c1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 when the category is not found or owned by another user', async () => {
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(undefined),
    });
    const service = buildService(repository);

    await expect(service.update('user-id', 'c1', { name: 'New' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects moving a category under one of its descendants with 409', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(buildCategory({ id: 'p1', type: 'expense' })),
      isDescendantOf: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(service.update('user-id', 'c1', { parentId: 'p1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects a parent of a different type with 422', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(buildCategory({ id: 'p1', type: 'income' })),
    });
    const service = buildService(repository);

    await expect(service.update('user-id', 'c1', { parentId: 'p1' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('moves a category to top level with parentId null', async () => {
    const expectedCategory = buildCategory({ parentId: null });
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(buildCategory({ id: 'c1', parentId: 'p1' })),
      update: vi.fn().mockResolvedValue(expectedCategory),
    });
    const service = buildService(repository);

    await expect(service.update('user-id', 'c1', { parentId: null })).resolves.toEqual(
      expectedCategory,
    );
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'c1', userId: 'user-id', data: { parentId: null } },
      FAKE_TX,
    );
  });
});

describe('TransactionCategoriesService.delete', () => {
  it('hard-deletes a category with no dependents', async () => {
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(buildCategory()),
    });
    const service = buildService(repository);

    await expect(service.delete('user-id', 'c1', {})).resolves.toBeUndefined();
    expect(repository.deleteScoped).toHaveBeenCalledWith('c1', 'user-id', FAKE_TX);
    expect(repository.reassignTransactions).not.toHaveBeenCalled();
    expect(repository.reassignChildren).not.toHaveBeenCalled();
  });

  it('requires a transaction target with 422 when the category has transactions', async () => {
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(buildCategory()),
      hasTransactions: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(service.delete('user-id', 'c1', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(repository.deleteScoped).not.toHaveBeenCalled();
  });

  it('requires an explicit children target with 422 when the category has children', async () => {
    const repository = buildRepository({
      findByIdScoped: vi.fn().mockResolvedValue(buildCategory()),
      hasChildren: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(service.delete('user-id', 'c1', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('reassigns transactions and children then deletes', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(buildCategory({ id: 'target', type: 'expense' })),
      hasTransactions: vi.fn().mockResolvedValue(true),
      hasChildren: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await service.delete('user-id', 'c1', {
      reassignTransactionsToCategoryId: 'target',
      reassignChildrenToParentId: null,
    });

    expect(repository.reassignTransactions).toHaveBeenCalledWith(
      { fromCategoryId: 'c1', toCategoryId: 'target', userId: 'user-id' },
      FAKE_TX,
    );
    expect(repository.reassignChildren).toHaveBeenCalledWith(
      { fromParentId: 'c1', toParentId: null, userId: 'user-id' },
      FAKE_TX,
    );
    expect(repository.deleteScoped).toHaveBeenCalledWith('c1', 'user-id', FAKE_TX);
  });

  it('rejects a missing transaction reassignment target with 422', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(undefined),
      hasTransactions: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(
      service.delete('user-id', 'c1', { reassignTransactionsToCategoryId: 'missing' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repository.deleteScoped).not.toHaveBeenCalled();
  });

  it('rejects a missing children reassignment target with 422', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(undefined),
      hasChildren: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(
      service.delete('user-id', 'c1', { reassignChildrenToParentId: 'missing' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repository.deleteScoped).not.toHaveBeenCalled();
  });

  it('rejects reassigning transactions to a different type with 422', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(buildCategory({ id: 'target', type: 'income' })),
      hasTransactions: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(
      service.delete('user-id', 'c1', { reassignTransactionsToCategoryId: 'target' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects reassigning children to a different-type parent with 422', async () => {
    const repository = buildRepository({
      findByIdScoped: vi
        .fn()
        .mockResolvedValueOnce(buildCategory({ id: 'c1', type: 'expense' }))
        .mockResolvedValueOnce(buildCategory({ id: 'target', type: 'income' })),
      hasChildren: vi.fn().mockResolvedValue(true),
    });
    const service = buildService(repository);

    await expect(
      service.delete('user-id', 'c1', { reassignChildrenToParentId: 'target' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
