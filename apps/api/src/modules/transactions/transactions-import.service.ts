import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { extname } from 'node:path';

import { checkIsCurrencyCode } from '@supertool/shared/constants/currency';
import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { TRANSACTION_IMPORT_MAX_ROWS } from '@supertool/shared/constants/transaction-import';
import {
  checkIsCalendarDate,
  POSITIVE_AMOUNT_PATTERN,
} from '@supertool/shared/constants/transaction-validation';

import type { SeedSourceRecord } from '../../database/seeds/seed.types';
import type { TransactionImportPreviewResponseDto } from './dtos/transaction-import-preview-response.dto';
import type { TransactionImportResponseDto } from './dtos/transaction-import-response.dto';

import { buildImportKey } from '../../database/seeds/build-import-key';
import { convertAmountToString } from '../../database/seeds/convert-amount';
import { deriveCategoryHierarchy } from '../../database/seeds/derive-category-hierarchy';
import { findNearDuplicateCategories } from '../../database/seeds/find-near-duplicate-categories';
import { parseSeedDate } from '../../database/seeds/parse-seed-date';
import { AnalyticsCacheService } from '../analytics/analytics-cache.service';
import { TransactionsRepository } from './transactions.repository';

const IMPORT_MAX_REPORTED_ROW_ERRORS = 50;
const ROW_NUMBER_OFFSET = 1;
const NO_ROWS = 0;
const JSON_EXTENSION = '.json';
const CSV_EXTENSION = '.csv';
const REQUIRED_CSV_HEADER_LIST = ['Date', 'Category', 'Type', 'Amount', 'Currency'];
const LEADING_BOM_PATTERN = /^\uFEFF/u;

const CANONICAL_TYPE_BY_LOWERCASE: Readonly<Record<string, 'Expense' | 'Income'>> = {
  expense: 'Expense',
  income: 'Income',
};

const throwValidationError = (message: string, details?: Record<string, unknown>): never => {
  throw new BadRequestException({
    code: ErrorCode.ValidationError,
    message,
    ...(details === undefined ? {} : { details }),
  });
};

const checkIsRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonRowList = (buffer: Buffer): unknown[] => {
  let parsed: unknown = undefined;
  try {
    parsed = JSON.parse(buffer.toString('utf8').replace(LEADING_BOM_PATTERN, ''));
  } catch {
    throwValidationError('File is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    return throwValidationError('JSON file must contain an array of transaction rows');
  }

  return parsed;
};

const assertRequiredCsvHeaders = (firstRow: unknown): void => {
  if (!checkIsRecord(firstRow)) {
    return;
  }

  const missingHeaderList = REQUIRED_CSV_HEADER_LIST.filter((header) => !(header in firstRow));

  if (missingHeaderList.length > NO_ROWS) {
    throwValidationError(`Missing required CSV headers: ${missingHeaderList.join(', ')}`);
  }
};

const parseCsvRowList = (buffer: Buffer): unknown[] => {
  let rowList: unknown[] = [];
  try {
    rowList = parse(buffer, { bom: true, columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throwValidationError('File is not valid CSV');
  }

  assertRequiredCsvHeaders(rowList[0]);

  return rowList;
};

const parseRawRowList = (file: Express.Multer.File): unknown[] => {
  const extension = extname(file.originalname).toLowerCase();

  if (extension === JSON_EXTENSION) {
    return parseJsonRowList(file.buffer);
  }

  if (extension === CSV_EXTENSION) {
    return parseCsvRowList(file.buffer);
  }

  return throwValidationError('Unsupported file format. Upload a .json or .csv file');
};

const parseRowDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    return checkIsCalendarDate(parseSeedDate(value)) ? value : undefined;
  } catch {
    return undefined;
  }
};

const parseRowName = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  return value.trim();
};

const parseRowType = (value: unknown): 'Expense' | 'Income' | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return CANONICAL_TYPE_BY_LOWERCASE[value.trim().toLowerCase()];
};

const parseRowAmount = (value: unknown): number | string | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined;
  }

  try {
    return POSITIVE_AMOUNT_PATTERN.test(convertAmountToString(value)) ? value : undefined;
  } catch {
    return undefined;
  }
};

const parseRowCurrency = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !checkIsCurrencyCode(value)) {
    return undefined;
  }

  return value;
};

interface SubcategoryField {
  value: string | undefined;
  isValid: boolean;
}

const parseRowSubcategory = (value: unknown): SubcategoryField => {
  if (value === undefined || value === null) {
    return { value: undefined, isValid: true };
  }

  if (typeof value !== 'string') {
    return { value: undefined, isValid: false };
  }

  const trimmed = value.trim();

  return { value: trimmed === '' ? undefined : trimmed, isValid: true };
};

interface RowValidationResult {
  record?: SeedSourceRecord;
  errorList: string[];
}

interface ParsedRowFields {
  date: string | undefined;
  category: string | undefined;
  type: 'Expense' | 'Income' | undefined;
  amount: number | string | undefined;
  currency: string | undefined;
  subcategory: SubcategoryField;
}

interface CompleteRowFields {
  date: string;
  category: string;
  type: 'Expense' | 'Income';
  amount: number | string;
  currency: string;
  subcategory: SubcategoryField;
}

const parseRowFields = (rawRow: Record<string, unknown>): ParsedRowFields => ({
  date: parseRowDate(rawRow['Date']),
  category: parseRowName(rawRow['Category']),
  type: parseRowType(rawRow['Type']),
  amount: parseRowAmount(rawRow['Amount']),
  currency: parseRowCurrency(rawRow['Currency']),
  subcategory: parseRowSubcategory(rawRow['Subcategory']),
});

const buildRowFieldErrorList = (fields: ParsedRowFields, rowLabel: string): string[] => {
  const failureList: readonly (readonly [boolean, string])[] = [
    [fields.date === undefined, '"Date" must be a parseable MM/DD/YYYY[ HH:mm:ss] date'],
    [fields.category === undefined, '"Category" must be a non-empty string'],
    [fields.type === undefined, '"Type" must be "Expense" or "Income"'],
    [
      fields.amount === undefined,
      '"Amount" must be a positive number with at most two decimal places',
    ],
    [fields.currency === undefined, '"Currency" must be a known ISO 4217 currency code'],
    [!fields.subcategory.isValid, '"Subcategory" must be a string when present'],
  ];

  return failureList.flatMap(([hasError, message]) =>
    hasError ? [`${rowLabel}: ${message}`] : [],
  );
};

const checkIsCompleteRow = (
  fields: ParsedRowFields,
): fields is ParsedRowFields & CompleteRowFields =>
  fields.date !== undefined &&
  fields.category !== undefined &&
  fields.type !== undefined &&
  fields.amount !== undefined &&
  fields.currency !== undefined &&
  fields.subcategory.isValid;

const buildRecordFromFields = (fields: CompleteRowFields): SeedSourceRecord => ({
  Date: fields.date,
  Category: fields.category,
  Type: fields.type,
  Amount: fields.amount,
  Currency: fields.currency,
  ...(fields.subcategory.value === undefined ? {} : { Subcategory: fields.subcategory.value }),
});

const buildRowRecord = (rawRow: unknown, rowIndex: number): RowValidationResult => {
  const rowLabel = `Row ${rowIndex + ROW_NUMBER_OFFSET}`;

  if (!checkIsRecord(rawRow)) {
    return {
      errorList: [
        `${rowLabel}: must be an object with Date, Category, Type, Amount and Currency fields`,
      ],
    };
  }

  const fields = parseRowFields(rawRow);

  if (!checkIsCompleteRow(fields)) {
    return { errorList: buildRowFieldErrorList(fields, rowLabel) };
  }

  return { record: buildRecordFromFields(fields), errorList: [] };
};

const assertRowListBounds = (rawRowList: unknown[]): void => {
  if (rawRowList.length === NO_ROWS) {
    throwValidationError('File contains no transaction rows');
  }

  if (rawRowList.length > TRANSACTION_IMPORT_MAX_ROWS) {
    throwValidationError(
      `File contains ${rawRowList.length} rows, the maximum is ${TRANSACTION_IMPORT_MAX_ROWS}`,
    );
  }
};

const collectValidatedRecords = (
  rawRowList: unknown[],
): { recordList: SeedSourceRecord[]; rowErrorList: string[] } => {
  const recordList: SeedSourceRecord[] = [];
  const rowErrorList: string[] = [];

  rawRowList.forEach((rawRow, rowIndex) => {
    const { record, errorList } = buildRowRecord(rawRow, rowIndex);
    rowErrorList.push(...errorList);
    if (record !== undefined) {
      recordList.push(record);
    }
  });

  return { recordList, rowErrorList };
};

const parseImportFile = (file: Express.Multer.File): SeedSourceRecord[] => {
  const rawRowList = parseRawRowList(file);
  assertRowListBounds(rawRowList);

  const { recordList, rowErrorList } = collectValidatedRecords(rawRowList);

  if (rowErrorList.length > NO_ROWS) {
    throwValidationError('Import file failed row validation', {
      rowErrorList: rowErrorList.slice(NO_ROWS, IMPORT_MAX_REPORTED_ROW_ERRORS),
    });
  }

  return recordList;
};

const buildUniqueNameListToCreate = (
  derivedNameList: string[],
  existingNameSet: Set<string>,
): string[] => [...new Set(derivedNameList.filter((name) => !existingNameSet.has(name)))];

@Injectable()
export class TransactionsImportService {
  constructor(
    @Inject(TransactionsRepository) private readonly transactionsRepository: TransactionsRepository,
    @Inject(AnalyticsCacheService) private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async importTransactions(
    userId: string,
    file: Express.Multer.File,
  ): Promise<TransactionImportResponseDto> {
    const recordList = parseImportFile(file);
    const report = await this.transactionsRepository.runImport({ userId, recordList });

    this.analyticsCache.invalidateUser(userId);

    return {
      inserted: report.inserted,
      skippedDuplicates: report.skippedDuplicates,
      topLevelCategoriesCreated: report.topLevelCreated,
      childCategoriesCreated: report.childrenCreated,
      nearDuplicateClusterList: report.nearDuplicateClusterList,
    };
  }

  async previewImport(
    userId: string,
    file: Express.Multer.File,
  ): Promise<TransactionImportPreviewResponseDto> {
    const recordList = parseImportFile(file);
    const importKeyList = recordList.map((record, rowIndex) =>
      buildImportKey({ record, rowIndex }),
    );

    const [existingImportKeySet, categoryNameSets] = await Promise.all([
      this.transactionsRepository.findExistingImportKeys(userId, importKeyList),
      this.transactionsRepository.findCategoryNameSetsByUserId(userId),
    ]);

    const duplicateRows = importKeyList.filter((importKey) =>
      existingImportKeySet.has(importKey),
    ).length;
    const hierarchy = deriveCategoryHierarchy(recordList);

    return {
      totalRows: recordList.length,
      newRows: recordList.length - duplicateRows,
      duplicateRows,
      topLevelCategoriesToCreateList: buildUniqueNameListToCreate(
        hierarchy.topLevelList.map((category) => category.name),
        categoryNameSets.topLevelNameSet,
      ),
      childCategoriesToCreateList: buildUniqueNameListToCreate(
        hierarchy.childList.map((category) => category.name),
        categoryNameSets.childNameSet,
      ),
      nearDuplicateClusterList: findNearDuplicateCategories(recordList),
    };
  }
}
