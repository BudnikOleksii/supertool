import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { TRANSACTION_IMPORT_MAX_ROWS } from '@supertool/shared/constants/transaction-import';

import type { SeedReport } from '../../database/seeds/seed.types';
import type { TransactionsRepository } from './transactions.repository';

import { TransactionsImportService } from './transactions-import.service';

const EXPECTED_REPORTED_ROW_ERROR_CAP = 50;
const SINGLE_CALL = 1;
const PREVIEW_TOTAL_ROWS = 2;
const SINGLE_ROW = 1;

const VALID_JSON_ROW = {
  Date: '02/03/2025 15:41:17',
  Category: 'Їжа',
  Type: 'Expense',
  Amount: 1588.29,
  Currency: 'UAH',
  Subcategory: 'Кафе',
};

const EMPTY_SEED_REPORT: SeedReport = {
  inserted: 0,
  skippedDuplicates: 0,
  topLevelCreated: 0,
  childrenCreated: 0,
  nearDuplicateClusterList: [],
};

const CSV_HEADER_LINE = 'Date,Category,Type,Amount,Currency,Subcategory';

const buildFile = (originalname: string, content: string): Express.Multer.File =>
  ({ originalname, buffer: Buffer.from(content, 'utf8') }) as unknown as Express.Multer.File;

const buildJsonFile = (rowList: unknown[]): Express.Multer.File =>
  buildFile('import.json', JSON.stringify(rowList));

const buildCsvFile = (lineList: string[]): Express.Multer.File =>
  buildFile('import.csv', [CSV_HEADER_LINE, ...lineList].join('\n'));

const buildRepositoryDouble = () => ({
  runImport: vi.fn().mockResolvedValue(EMPTY_SEED_REPORT),
  findExistingImportKeys: vi.fn().mockResolvedValue(new Set<string>()),
  findCategoryNameSetsByUserId: vi.fn().mockResolvedValue({
    topLevelNameSet: new Set<string>(),
    childNameSet: new Set<string>(),
  }),
});

const buildService = (repositoryDouble: ReturnType<typeof buildRepositoryDouble>) =>
  new TransactionsImportService(repositoryDouble as unknown as TransactionsRepository);

const checkIsRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getBadRequestBody = async (promise: Promise<unknown>): Promise<Record<string, unknown>> => {
  const caught: unknown = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );

  if (!(caught instanceof BadRequestException)) {
    throw new Error('expected a BadRequestException');
  }

  const body = caught.getResponse();

  if (!checkIsRecord(body)) {
    throw new Error('expected an object exception body');
  }

  return body;
};

const getRowErrorList = (body: Record<string, unknown>): string[] => {
  const { details } = body;

  if (!checkIsRecord(details) || !Array.isArray(details['rowErrorList'])) {
    throw new Error('expected details.rowErrorList');
  }

  return details['rowErrorList'].filter((entry): entry is string => typeof entry === 'string');
};

describe('TransactionsImportService', () => {
  describe('importTransactions', () => {
    it('ingests a JSON array and delegates validated records to the repository', async () => {
      const repositoryDouble = buildRepositoryDouble();
      const service = buildService(repositoryDouble);

      const actual = await service.importTransactions(
        'user-id',
        buildJsonFile([VALID_JSON_ROW, { ...VALID_JSON_ROW, Subcategory: undefined }]),
      );

      expect(repositoryDouble.runImport).toHaveBeenCalledWith({
        userId: 'user-id',
        recordList: [
          {
            Date: '02/03/2025 15:41:17',
            Category: 'Їжа',
            Type: 'Expense',
            Amount: 1588.29,
            Currency: 'UAH',
            Subcategory: 'Кафе',
          },
          {
            Date: '02/03/2025 15:41:17',
            Category: 'Їжа',
            Type: 'Expense',
            Amount: 1588.29,
            Currency: 'UAH',
          },
        ],
      });
      expect(actual).toEqual({
        inserted: 0,
        skippedDuplicates: 0,
        topLevelCategoriesCreated: 0,
        childCategoriesCreated: 0,
        nearDuplicateClusterList: [],
      });
    });

    it('ingests CSV rows keeping amounts as strings, never coerced to numbers', async () => {
      const repositoryDouble = buildRepositoryDouble();
      const service = buildService(repositoryDouble);

      await service.importTransactions(
        'user-id',
        buildCsvFile(['02/03/2025 15:41:17,Їжа,Expense,1588.29,UAH,Кафе']),
      );

      const [input] = repositoryDouble.runImport.mock.calls[0] ?? [];
      expect(input.recordList[0].Amount).toBe('1588.29');
    });

    it('accepts case-variant types and canonicalizes them so they persist as income', async () => {
      const repositoryDouble = buildRepositoryDouble();
      const service = buildService(repositoryDouble);

      await service.importTransactions(
        'user-id',
        buildJsonFile([
          { ...VALID_JSON_ROW, Type: 'income' },
          { ...VALID_JSON_ROW, Type: 'INCOME' },
          { ...VALID_JSON_ROW, Type: 'expense' },
        ]),
      );

      const [input] = repositoryDouble.runImport.mock.calls[0] ?? [];
      expect(input.recordList.map((record: { Type: string }) => record.Type)).toEqual([
        'Income',
        'Income',
        'Expense',
      ]);
    });

    it('maps the seed report onto the execute response', async () => {
      const repositoryDouble = buildRepositoryDouble();
      const expectedCluster = {
        normalizedKey: 'їжа',
        rawNameList: ['Їжа', 'їжа'],
        hasMixedScript: false,
      };
      repositoryDouble.runImport.mockResolvedValue({
        inserted: 2,
        skippedDuplicates: 1,
        topLevelCreated: 3,
        childrenCreated: 4,
        nearDuplicateClusterList: [expectedCluster],
      });
      const service = buildService(repositoryDouble);

      const actual = await service.importTransactions('user-id', buildJsonFile([VALID_JSON_ROW]));

      expect(actual).toEqual({
        inserted: 2,
        skippedDuplicates: 1,
        topLevelCategoriesCreated: 3,
        childCategoriesCreated: 4,
        nearDuplicateClusterList: [expectedCluster],
      });
    });
  });

  describe('row validation', () => {
    it.each([
      ['zero amount', { ...VALID_JSON_ROW, Amount: 0 }, '"Amount"'],
      ['negative amount', { ...VALID_JSON_ROW, Amount: -5 }, '"Amount"'],
      ['non-numeric string amount', { ...VALID_JSON_ROW, Amount: 'abc' }, '"Amount"'],
      ['literal NaN amount', { ...VALID_JSON_ROW, Amount: 'NaN' }, '"Amount"'],
      ['unknown type', { ...VALID_JSON_ROW, Type: 'Transfer' }, '"Type"'],
      ['unparseable date', { ...VALID_JSON_ROW, Date: '13/45/2025' }, '"Date"'],
      ['unknown currency', { ...VALID_JSON_ROW, Currency: 'ZZZ' }, '"Currency"'],
      ['empty category', { ...VALID_JSON_ROW, Category: '  ' }, '"Category"'],
      ['non-string subcategory', { ...VALID_JSON_ROW, Subcategory: 7 }, '"Subcategory"'],
    ])('rejects a row with %s and writes nothing', async (_label, inputRow, expectedFragment) => {
      const repositoryDouble = buildRepositoryDouble();
      const service = buildService(repositoryDouble);

      const body = await getBadRequestBody(
        service.importTransactions('user-id', buildJsonFile([inputRow])),
      );

      expect(body['code']).toBe(ErrorCode.ValidationError);
      expect(getRowErrorList(body)[0]).toContain('Row 1');
      expect(getRowErrorList(body)[0]).toContain(expectedFragment);
      expect(repositoryDouble.runImport).not.toHaveBeenCalled();
    });

    it('reports row numbers 1-based for a bad row after valid rows', async () => {
      const service = buildService(buildRepositoryDouble());

      const body = await getBadRequestBody(
        service.importTransactions(
          'user-id',
          buildJsonFile([VALID_JSON_ROW, VALID_JSON_ROW, { ...VALID_JSON_ROW, Type: 'Transfer' }]),
        ),
      );

      expect(getRowErrorList(body)).toEqual([expect.stringContaining('Row 3')]);
    });

    it('collects every row error and caps the reported list', async () => {
      const service = buildService(buildRepositoryDouble());
      const badRowCount = 60;
      const badRowList = Array.from({ length: badRowCount }, () => ({
        ...VALID_JSON_ROW,
        Amount: 'abc',
      }));

      const body = await getBadRequestBody(
        service.importTransactions('user-id', buildJsonFile(badRowList)),
      );

      const rowErrorList = getRowErrorList(body);
      expect(rowErrorList).toHaveLength(EXPECTED_REPORTED_ROW_ERROR_CAP);
      expect(rowErrorList[0]).toContain('Row 1');
    });

    it('rejects a non-object row', async () => {
      const service = buildService(buildRepositoryDouble());

      const body = await getBadRequestBody(
        service.importTransactions('user-id', buildJsonFile(['not-a-row'])),
      );

      expect(getRowErrorList(body)[0]).toContain('Row 1');
    });
  });

  describe('file validation', () => {
    it.each([
      ['an unsupported extension', buildFile('import.txt', 'Date'), 'Unsupported file format'],
      ['invalid JSON', buildFile('import.json', '{nope'), 'not valid JSON'],
      ['a non-array JSON payload', buildFile('import.json', '{"Date":"x"}'), 'array'],
      ['an empty JSON array', buildJsonFile([]), 'no transaction rows'],
      ['a header-only CSV', buildCsvFile([]), 'no transaction rows'],
      [
        'a CSV missing required headers',
        buildFile('import.csv', 'Date,Category\n02/03/2025,Їжа'),
        'Missing required CSV headers: Type, Amount, Currency',
      ],
    ])('rejects %s with the shared envelope', async (_label, inputFile, expectedFragment) => {
      const repositoryDouble = buildRepositoryDouble();
      const service = buildService(repositoryDouble);

      const body = await getBadRequestBody(service.importTransactions('user-id', inputFile));

      expect(body['code']).toBe(ErrorCode.ValidationError);
      expect(body['message']).toContain(expectedFragment);
      expect(repositoryDouble.runImport).not.toHaveBeenCalled();
    });

    it('rejects a file above the row cap', async () => {
      const service = buildService(buildRepositoryDouble());
      const overflowRowList = Array.from(
        { length: TRANSACTION_IMPORT_MAX_ROWS + 1 },
        () => VALID_JSON_ROW,
      );

      const body = await getBadRequestBody(
        service.importTransactions('user-id', buildJsonFile(overflowRowList)),
      );

      expect(body['message']).toContain(`maximum is ${TRANSACTION_IMPORT_MAX_ROWS}`);
    });
  });

  describe('previewImport', () => {
    it('reports duplicate and new rows without writing anything', async () => {
      const repositoryDouble = buildRepositoryDouble();
      repositoryDouble.findExistingImportKeys.mockImplementation(
        (_userId: string, importKeyList: string[]) => Promise.resolve(new Set([importKeyList[0]])),
      );
      const service = buildService(repositoryDouble);

      const actual = await service.previewImport(
        'user-id',
        buildJsonFile([VALID_JSON_ROW, { ...VALID_JSON_ROW, Amount: 42 }]),
      );

      expect(actual).toMatchObject({
        totalRows: PREVIEW_TOTAL_ROWS,
        duplicateRows: SINGLE_ROW,
        newRows: SINGLE_ROW,
      });
      expect(repositoryDouble.runImport).not.toHaveBeenCalled();
    });

    it('diffs derived categories against the existing name sets', async () => {
      const repositoryDouble = buildRepositoryDouble();
      repositoryDouble.findCategoryNameSetsByUserId.mockResolvedValue({
        topLevelNameSet: new Set(['Їжа']),
        childNameSet: new Set<string>(),
      });
      const service = buildService(repositoryDouble);

      const actual = await service.previewImport(
        'user-id',
        buildJsonFile([
          VALID_JSON_ROW,
          { ...VALID_JSON_ROW, Category: 'Транспорт', Subcategory: 'Таксі' },
        ]),
      );

      expect(actual.topLevelCategoriesToCreateList).toEqual(['Транспорт']);
      expect(actual.childCategoriesToCreateList).toEqual(['Кафе', 'Таксі']);
      expect(repositoryDouble.findExistingImportKeys).toHaveBeenCalledTimes(SINGLE_CALL);
    });

    it('surfaces near-duplicate category clusters instead of merging them', async () => {
      const service = buildService(buildRepositoryDouble());

      const actual = await service.previewImport(
        'user-id',
        buildJsonFile([VALID_JSON_ROW, { ...VALID_JSON_ROW, Category: 'їжа' }]),
      );

      expect(actual.nearDuplicateClusterList).toEqual([
        { normalizedKey: 'їжа', rawNameList: ['Їжа', 'їжа'], hasMixedScript: false },
      ]);
    });
  });
});
