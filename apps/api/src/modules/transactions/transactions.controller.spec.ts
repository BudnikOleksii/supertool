import type { ExecutionContext } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';
import { TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } from '@supertool/shared/constants/transaction-import';

import type { auth } from '../../auth/auth';

import { AuthGuard } from '../../shared/guards/auth.guard';
import { TransactionsImportService } from './transactions-import.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

const OVERSIZE_EXTRA_BYTES = 1;

const createSession = (userId: string): UserSession<typeof auth> =>
  ({ user: { id: userId } }) as unknown as UserSession<typeof auth>;

const createImportFile = (originalname: string): Express.Multer.File =>
  ({ originalname, buffer: Buffer.from('[]', 'utf8') }) as unknown as Express.Multer.File;

const authGuardDouble = {
  canActivate: (context: ExecutionContext): boolean => {
    const request = context.switchToHttp().getRequest<{ session?: unknown }>();
    request.session = { user: { id: 'user-id' } };
    return true;
  },
};

const bootControllerApp = async (importTransactions: ReturnType<typeof vi.fn>) => {
  const moduleRef = await Test.createTestingModule({
    controllers: [TransactionsController],
    providers: [
      { provide: TransactionsService, useValue: {} },
      { provide: TransactionsImportService, useValue: { importTransactions } },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue(authGuardDouble)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.listen(0);

  return app;
};

const postOversizeImport = async (appUrl: string): Promise<Response> => {
  const oversizeContent = new Uint8Array(
    TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES + OVERSIZE_EXTRA_BYTES,
  );
  const formData = new FormData();
  formData.append('file', new Blob([oversizeContent], { type: 'application/json' }), 'big.json');

  return fetch(`${appUrl}/transactions/import`, { method: 'POST', body: formData });
};

describe('TransactionsController', () => {
  it('forwards the session user id and query to the service', async () => {
    const expectedResult = {
      data: [],
      meta: { page: 1, limit: 50, total: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: { findAll } },
        { provide: TransactionsImportService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputQuery = {
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      type: 'expense' as const,
      categoryId: 'category-id',
      sortBy: 'amount' as const,
      sortOrder: 'asc' as const,
      page: 1,
      limit: 50,
    };

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
      providers: [
        { provide: TransactionsService, useValue: { create } },
        { provide: TransactionsImportService, useValue: {} },
      ],
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

  it('forwards the session user id and transaction id to the service on findOne', async () => {
    const expectedResult = { id: 'transaction-1' };
    const findOne = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: { findOne } },
        { provide: TransactionsImportService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);

    await expect(controller.findOne(createSession('user-id'), 'transaction-1')).resolves.toEqual(
      expectedResult,
    );
    expect(findOne).toHaveBeenCalledWith('user-id', 'transaction-1');
  });

  it('forwards the session user id, id, and body to the service on update', async () => {
    const expectedResult = { id: 'transaction-1' };
    const update = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: { update } },
        { provide: TransactionsImportService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputDto = {
      type: 'expense' as const,
      amount: '99.99',
      currency: 'UAH',
      categoryId: 'category-id',
      date: '2025-03-10',
    };

    await expect(
      controller.update(createSession('user-id'), 'transaction-1', inputDto),
    ).resolves.toEqual(expectedResult);
    expect(update).toHaveBeenCalledWith('user-id', 'transaction-1', inputDto);
  });

  it('forwards the session user id and id to the service on remove', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: { delete: remove } },
        { provide: TransactionsImportService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);

    await expect(
      controller.remove(createSession('user-id'), 'transaction-1'),
    ).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith('user-id', 'transaction-1');
  });

  it('forwards the session user id and id list to the service on bulkDelete', async () => {
    const expectedResult = { deletedCount: 2, failedList: [] };
    const bulkDelete = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: { bulkDelete } },
        { provide: TransactionsImportService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputIdList = ['transaction-1', 'transaction-2'];

    await expect(
      controller.bulkDelete(createSession('user-id'), { idList: inputIdList }),
    ).resolves.toEqual(expectedResult);
    expect(bulkDelete).toHaveBeenCalledWith('user-id', inputIdList);
  });

  it('forwards the session user id and file to the import service on import', async () => {
    const expectedResult = {
      inserted: 2,
      skippedDuplicates: 0,
      topLevelCategoriesCreated: 1,
      childCategoriesCreated: 1,
      nearDuplicateClusterList: [],
    };
    const importTransactions = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: {} },
        { provide: TransactionsImportService, useValue: { importTransactions } },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputFile = createImportFile('import.json');

    await expect(controller.import(createSession('user-id'), inputFile)).resolves.toEqual(
      expectedResult,
    );
    expect(importTransactions).toHaveBeenCalledWith('user-id', inputFile);
  });

  it('forwards the session user id and file to the import service on preview', async () => {
    const expectedResult = {
      totalRows: 2,
      newRows: 2,
      duplicateRows: 0,
      topLevelCategoriesToCreateList: [],
      childCategoriesToCreateList: [],
      nearDuplicateClusterList: [],
    };
    const previewImport = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: {} },
        { provide: TransactionsImportService, useValue: { previewImport } },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);
    const inputFile = createImportFile('import.csv');

    await expect(controller.importPreview(createSession('user-id'), inputFile)).resolves.toEqual(
      expectedResult,
    );
    expect(previewImport).toHaveBeenCalledWith('user-id', inputFile);
  });

  it('rejects a missing upload with a 400 before reaching the import service', async () => {
    const importTransactions = vi.fn();
    const previewImport = vi.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: {} },
        { provide: TransactionsImportService, useValue: { importTransactions, previewImport } },
      ],
    }).compile();

    const controller = moduleRef.get(TransactionsController);

    await expect(controller.import(createSession('user-id'), undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.importPreview(createSession('user-id'), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(importTransactions).not.toHaveBeenCalled();
    expect(previewImport).not.toHaveBeenCalled();
  });

  it('rejects an upload above the size limit with 413 before reaching the import service', async () => {
    const importTransactions = vi.fn();
    const app = await bootControllerApp(importTransactions);

    try {
      const response = await postOversizeImport(await app.getUrl());

      expect(response.status).toBe(HTTP_STATUS_CODE.PayloadTooLarge);
      expect(importTransactions).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
