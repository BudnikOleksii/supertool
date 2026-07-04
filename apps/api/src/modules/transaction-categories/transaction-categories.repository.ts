import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';

import type { Database, DatabaseExecutor } from '../../database/database.types';
import type { TransactionType } from '../../database/schemas/enums';
import type { CategoryResponseDto } from './dtos/category-response.dto';
import type { DefaultCategoriesResponseDto } from './dtos/default-categories-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { generateId } from '../../database/generate-id';
import { transactionCategories } from '../../database/schemas/transaction-categories';
import { transactions } from '../../database/schemas/transactions';
import { DEFAULT_CATEGORY_CATALOG } from './transaction-categories.constants';

const CATEGORY_RESPONSE_COLUMNS = {
  id: transactionCategories.id,
  name: transactionCategories.name,
  type: transactionCategories.type,
  parentId: transactionCategories.parentId,
  createdAt: transactionCategories.createdAt,
  updatedAt: transactionCategories.updatedAt,
};

const EXISTS_LIMIT = 1;
const ANCESTRY_MAX_DEPTH = 100;

const CATEGORY_CONFLICT_TARGET = [
  transactionCategories.userId,
  transactionCategories.name,
  transactionCategories.type,
  transactionCategories.parentId,
];

const getCategoryKey = (name: string, type: TransactionType): string => `${name}::${type}`;

interface CategoryRow {
  id: string;
  name: string;
  type: TransactionType;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateCategoryData {
  userId: string;
  name: string;
  type: TransactionType;
  parentId: string | null;
}

interface UpdateCategoryParams {
  id: string;
  userId: string;
  data: { name?: string; parentId?: string | null };
}

interface DuplicateCheckParams {
  userId: string;
  name: string;
  type: TransactionType;
  parentId: string | null;
  excludeId?: string | undefined;
}

interface AncestryParams {
  categoryId: string;
  potentialAncestorId: string;
  userId: string;
}

interface ReassignTransactionsParams {
  fromCategoryId: string;
  toCategoryId: string;
  userId: string;
}

interface ReassignChildrenParams {
  fromParentId: string;
  toParentId: string | null;
  userId: string;
}

const toResponseDto = (row: CategoryRow): CategoryResponseDto => ({
  id: row.id,
  name: row.name,
  type: row.type,
  parentId: row.parentId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class TransactionCategoriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async runInTransaction<T>(callback: (tx: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(callback);
  }

  async createDefaults(userId: string): Promise<DefaultCategoriesResponseDto> {
    return this.db.transaction(async (tx) => {
      const parentRowList = DEFAULT_CATEGORY_CATALOG.map((category) => ({
        id: generateId(),
        userId,
        name: category.name,
        type: category.type,
        parentId: null,
      }));

      const insertedParentList = await tx
        .insert(transactionCategories)
        .values(parentRowList)
        .onConflictDoNothing({ target: CATEGORY_CONFLICT_TARGET })
        .returning({ id: transactionCategories.id });

      const parentIdByKey = await this.selectTopLevelIdByKey(userId, tx);

      const childRowList = DEFAULT_CATEGORY_CATALOG.flatMap((category) =>
        category.childList.map((childName) => ({
          id: generateId(),
          userId,
          name: childName,
          type: category.type,
          parentId: parentIdByKey.get(getCategoryKey(category.name, category.type)) ?? null,
        })),
      ).filter((row) => row.parentId !== null);

      const insertedChildList = childRowList.length
        ? await tx
            .insert(transactionCategories)
            .values(childRowList)
            .onConflictDoNothing({ target: CATEGORY_CONFLICT_TARGET })
            .returning({ id: transactionCategories.id })
        : [];

      return {
        topLevelCreated: insertedParentList.length,
        childrenCreated: insertedChildList.length,
      };
    });
  }

  private async selectTopLevelIdByKey(
    userId: string,
    executor: DatabaseExecutor,
  ): Promise<Map<string, string>> {
    const rowList = await executor
      .select({
        id: transactionCategories.id,
        name: transactionCategories.name,
        type: transactionCategories.type,
      })
      .from(transactionCategories)
      .where(and(eq(transactionCategories.userId, userId), isNull(transactionCategories.parentId)));

    return new Map(rowList.map((row) => [getCategoryKey(row.name, row.type), row.id]));
  }

  async findAllByUserId(userId: string): Promise<CategoryResponseDto[]> {
    const rowList = await this.db
      .select(CATEGORY_RESPONSE_COLUMNS)
      .from(transactionCategories)
      .where(eq(transactionCategories.userId, userId))
      .orderBy(transactionCategories.name);

    return rowList.map(toResponseDto);
  }

  async findByIdScoped(
    id: string,
    userId: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<CategoryResponseDto | undefined> {
    const [row] = await executor
      .select(CATEGORY_RESPONSE_COLUMNS)
      .from(transactionCategories)
      .where(and(eq(transactionCategories.id, id), eq(transactionCategories.userId, userId)))
      .limit(EXISTS_LIMIT);

    return row ? toResponseDto(row) : undefined;
  }

  async existsByNameTypeAndParent(
    params: DuplicateCheckParams,
    executor: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const conditionList = [
      eq(transactionCategories.userId, params.userId),
      eq(transactionCategories.name, params.name),
      eq(transactionCategories.type, params.type),
      params.parentId === null
        ? isNull(transactionCategories.parentId)
        : eq(transactionCategories.parentId, params.parentId),
    ];

    if (params.excludeId !== undefined) {
      conditionList.push(ne(transactionCategories.id, params.excludeId));
    }

    const [row] = await executor
      .select({ id: transactionCategories.id })
      .from(transactionCategories)
      .where(and(...conditionList))
      .limit(EXISTS_LIMIT);

    return row !== undefined;
  }

  async create(
    data: CreateCategoryData,
    executor: DatabaseExecutor = this.db,
  ): Promise<CategoryResponseDto> {
    const [row] = await executor
      .insert(transactionCategories)
      .values({
        id: generateId(),
        userId: data.userId,
        name: data.name,
        type: data.type,
        parentId: data.parentId,
      })
      .returning(CATEGORY_RESPONSE_COLUMNS);

    if (!row) {
      throw new Error('Category insert returned no row');
    }

    return toResponseDto(row);
  }

  async update(
    params: UpdateCategoryParams,
    executor: DatabaseExecutor = this.db,
  ): Promise<CategoryResponseDto | undefined> {
    const updateValues: Partial<typeof transactionCategories.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (params.data.name !== undefined) {
      updateValues.name = params.data.name;
    }

    if (params.data.parentId !== undefined) {
      updateValues.parentId = params.data.parentId;
    }

    const [row] = await executor
      .update(transactionCategories)
      .set(updateValues)
      .where(
        and(
          eq(transactionCategories.id, params.id),
          eq(transactionCategories.userId, params.userId),
        ),
      )
      .returning(CATEGORY_RESPONSE_COLUMNS);

    return row ? toResponseDto(row) : undefined;
  }

  async isDescendantOf(
    params: AncestryParams,
    executor: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const result = await executor.execute<{ found: boolean }>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id, 1 AS depth
        FROM transaction_categories
        WHERE id = ${params.categoryId} AND user_id = ${params.userId}
        UNION ALL
        SELECT tc.id, tc.parent_id, a.depth + 1
        FROM transaction_categories tc
        INNER JOIN ancestors a ON tc.id = a.parent_id
        WHERE tc.user_id = ${params.userId} AND a.depth < ${ANCESTRY_MAX_DEPTH}
      )
      SELECT EXISTS (
        SELECT 1 FROM ancestors WHERE id = ${params.potentialAncestorId}
      ) AS found
    `);

    return result.rows[0]?.found === true;
  }

  async hasTransactions(
    categoryId: string,
    userId: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await executor
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.categoryId, categoryId), eq(transactions.userId, userId)))
      .limit(EXISTS_LIMIT);

    return row !== undefined;
  }

  async hasChildren(
    categoryId: string,
    userId: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await executor
      .select({ id: transactionCategories.id })
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.parentId, categoryId),
          eq(transactionCategories.userId, userId),
        ),
      )
      .limit(EXISTS_LIMIT);

    return row !== undefined;
  }

  async reassignTransactions(
    params: ReassignTransactionsParams,
    executor: DatabaseExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(transactions)
      .set({ categoryId: params.toCategoryId, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.categoryId, params.fromCategoryId),
          eq(transactions.userId, params.userId),
        ),
      );
  }

  async reassignChildren(
    params: ReassignChildrenParams,
    executor: DatabaseExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(transactionCategories)
      .set({ parentId: params.toParentId, updatedAt: new Date() })
      .where(
        and(
          eq(transactionCategories.parentId, params.fromParentId),
          eq(transactionCategories.userId, params.userId),
        ),
      );
  }

  async deleteScoped(
    id: string,
    userId: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<void> {
    await executor
      .delete(transactionCategories)
      .where(and(eq(transactionCategories.id, id), eq(transactionCategories.userId, userId)));
  }
}
