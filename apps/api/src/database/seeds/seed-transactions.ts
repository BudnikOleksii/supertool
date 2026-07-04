import type { Logger } from 'pino';

import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.types';
import type { CategoryHierarchy, SeedReport, SeedSourceRecord } from './seed.types';

import { generateId } from '../generate-id';
import { transactionCategories } from '../schemas/transaction-categories';
import { transactions } from '../schemas/transactions';
import { buildImportKey } from './build-import-key';
import { convertAmountToString } from './convert-amount';
import { deriveCategoryHierarchy } from './derive-category-hierarchy';
import { findNearDuplicateCategories } from './find-near-duplicate-categories';
import { normalizeTransactionType } from './normalize-transaction-type';
import { parseSeedDate } from './parse-seed-date';

const TRANSACTION_BATCH_SIZE = 100;

const CATEGORY_CONFLICT_TARGET = [
  transactionCategories.userId,
  transactionCategories.name,
  transactionCategories.type,
  transactionCategories.parentId,
];

interface SeedTransactionsOptions {
  db: DatabaseExecutor;
  userId: string;
  recordList: SeedSourceRecord[];
  logger: Logger;
}

interface CategoryIdMaps {
  topIdByName: Map<string, string>;
  childIdByName: Map<string, string>;
  topLevelCreated: number;
  childrenCreated: number;
}

const selectCategoryIdByName = async ({
  db,
  userId,
  isChild,
}: {
  db: DatabaseExecutor;
  userId: string;
  isChild: boolean;
}): Promise<Map<string, string>> => {
  const parentCondition = isChild
    ? isNotNull(transactionCategories.parentId)
    : isNull(transactionCategories.parentId);

  const rowList = await db
    .select({ id: transactionCategories.id, name: transactionCategories.name })
    .from(transactionCategories)
    .where(and(eq(transactionCategories.userId, userId), parentCondition));

  return new Map(rowList.map((row) => [row.name, row.id]));
};

const seedCategories = async ({
  db,
  userId,
  hierarchy,
}: {
  db: DatabaseExecutor;
  userId: string;
  hierarchy: CategoryHierarchy;
}): Promise<CategoryIdMaps> => {
  const topLevelRowList = hierarchy.topLevelList.map((category) => ({
    id: generateId(),
    userId,
    name: category.name,
    type: category.type,
    parentId: null,
  }));

  const insertedTopLevelList = topLevelRowList.length
    ? await db
        .insert(transactionCategories)
        .values(topLevelRowList)
        .onConflictDoNothing({ target: CATEGORY_CONFLICT_TARGET })
        .returning({ id: transactionCategories.id })
    : [];

  const topIdByName = await selectCategoryIdByName({ db, userId, isChild: false });

  const childRowList = hierarchy.childList.map((child) => {
    const parentId = topIdByName.get(child.parentName);
    if (!parentId) {
      throw new Error(`Parent category not found for subcategory: ${child.name}`);
    }
    return { id: generateId(), userId, name: child.name, type: child.type, parentId };
  });

  const insertedChildList = childRowList.length
    ? await db
        .insert(transactionCategories)
        .values(childRowList)
        .onConflictDoNothing({ target: CATEGORY_CONFLICT_TARGET })
        .returning({ id: transactionCategories.id })
    : [];

  const childIdByName = await selectCategoryIdByName({ db, userId, isChild: true });

  return {
    topIdByName,
    childIdByName,
    topLevelCreated: insertedTopLevelList.length,
    childrenCreated: insertedChildList.length,
  };
};

const buildTransactionRows = ({
  userId,
  recordList,
  topIdByName,
  childIdByName,
}: {
  userId: string;
  recordList: SeedSourceRecord[];
  topIdByName: Map<string, string>;
  childIdByName: Map<string, string>;
}): (typeof transactions.$inferInsert)[] =>
  recordList.map((record, rowIndex) => {
    const categoryId = record.Subcategory
      ? childIdByName.get(record.Subcategory)
      : topIdByName.get(record.Category);

    if (!categoryId) {
      throw new Error(`Category not resolved for record at index ${rowIndex}`);
    }

    return {
      id: generateId(),
      userId,
      categoryId,
      type: normalizeTransactionType(record.Type),
      amount: convertAmountToString(record.Amount),
      currency: record.Currency,
      date: parseSeedDate(record.Date),
      note: '',
      importKey: buildImportKey({ record, rowIndex }),
    };
  });

const splitIntoBatches = (
  rowList: (typeof transactions.$inferInsert)[],
): (typeof transactions.$inferInsert)[][] => {
  const batchList: (typeof transactions.$inferInsert)[][] = [];
  for (let start = 0; start < rowList.length; start += TRANSACTION_BATCH_SIZE) {
    batchList.push(rowList.slice(start, start + TRANSACTION_BATCH_SIZE));
  }
  return batchList;
};

const insertTransactionRows = async ({
  db,
  rowList,
}: {
  db: DatabaseExecutor;
  rowList: (typeof transactions.$inferInsert)[];
}): Promise<number> => {
  const insertedCountList = await Promise.all(
    splitIntoBatches(rowList).map((batch) =>
      db
        .insert(transactions)
        .values(batch)
        .onConflictDoNothing({ target: [transactions.userId, transactions.importKey] })
        .returning({ id: transactions.id })
        .then((insertedBatch) => insertedBatch.length),
    ),
  );

  return insertedCountList.reduce((total, batchCount) => total + batchCount, 0);
};

export const seedTransactions = async ({
  db,
  userId,
  recordList,
  logger,
}: SeedTransactionsOptions): Promise<SeedReport> => {
  const hierarchy = deriveCategoryHierarchy(recordList);
  const { topIdByName, childIdByName, topLevelCreated, childrenCreated } = await seedCategories({
    db,
    userId,
    hierarchy,
  });

  const rowList = buildTransactionRows({ userId, recordList, topIdByName, childIdByName });
  const inserted = await insertTransactionRows({ db, rowList });

  const report: SeedReport = {
    inserted,
    skippedDuplicates: recordList.length - inserted,
    topLevelCreated,
    childrenCreated,
    nearDuplicateClusterList: findNearDuplicateCategories(recordList),
  };

  logger.info({ seedReport: report }, 'Seed import complete');

  return report;
};
