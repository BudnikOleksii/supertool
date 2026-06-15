import type { AnyColumn, SQL } from 'drizzle-orm';

import { Inject, Injectable } from '@nestjs/common';
import { aliasedTable, and, asc, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type {
  TransactionSortBy,
  TransactionSortOrder,
} from '@supertool/shared/constants/transaction-sort';

import type { Database } from '../../database/database.types';
import type { TransactionType } from '../../database/schemas/enums';
import type { TransactionResponseDto } from './dtos/transaction-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { generateId } from '../../database/generate-id';
import { transactionCategories } from '../../database/schemas/transaction-categories';
import { transactions } from '../../database/schemas/transactions';

const SINGLE_ROW_LIMIT = 1;

const SUBTREE_MAX_DEPTH = 100;

interface FindAllByUserIdQuery {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  type?: TransactionType | undefined;
  categoryId?: string | undefined;
  sortBy: TransactionSortBy;
  sortOrder: TransactionSortOrder;
  page: number;
  limit: number;
}

interface FindAllByUserIdResult {
  data: TransactionResponseDto[];
  total: number;
}

interface CreateTransactionInput {
  userId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  currency: string;
  date: string;
  note: string;
}

interface UpdateTransactionInput {
  categoryId: string;
  type: TransactionType;
  amount: string;
  currency: string;
  date: string;
  note: string;
}

interface ScopedCategory {
  id: string;
  type: TransactionType;
}

const NO_ROWS_AFFECTED = 0;

const parentCategory = aliasedTable(transactionCategories, 'parent_category');

const TRANSACTION_LIST_COLUMNS = {
  id: transactions.id,
  date: transactions.date,
  type: transactions.type,
  amount: transactions.amount,
  currency: transactions.currency,
  note: transactions.note,
  categoryId: transactions.categoryId,
  categoryName: transactionCategories.name,
  categoryParentName: parentCategory.name,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
};

const buildScopedConditions = (
  userId: string,
  query: FindAllByUserIdQuery,
  categoryIdList: string[] | undefined,
): SQL[] => {
  const conditions: SQL[] = [eq(transactions.userId, userId)];

  if (query.dateFrom !== undefined) {
    conditions.push(gte(transactions.date, query.dateFrom));
  }

  if (query.dateTo !== undefined) {
    conditions.push(lte(transactions.date, query.dateTo));
  }

  if (query.type !== undefined) {
    conditions.push(eq(transactions.type, query.type));
  }

  if (categoryIdList !== undefined) {
    conditions.push(inArray(transactions.categoryId, categoryIdList));
  }

  return conditions;
};

const SORT_COLUMN_BY_KEY: Record<TransactionSortBy, AnyColumn> = {
  date: transactions.date,
  amount: transactions.amount,
};

const buildOrderBy = (sortBy: TransactionSortBy, sortOrder: TransactionSortOrder): SQL[] => {
  const primaryColumn = SORT_COLUMN_BY_KEY[sortBy];
  const applyDirection = sortOrder === 'asc' ? asc : desc;

  return [applyDirection(primaryColumn), desc(transactions.id)];
};

const mapRowToResponse = (row: {
  id: string;
  date: string;
  type: TransactionResponseDto['type'];
  amount: string;
  currency: string;
  note: string;
  categoryId: string;
  categoryName: string | null;
  categoryParentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TransactionResponseDto => ({
  id: row.id,
  date: row.date,
  type: row.type,
  amount: row.amount,
  currency: row.currency,
  note: row.note,
  categoryId: row.categoryId,
  categoryName: row.categoryName ?? '',
  categoryParentName: row.categoryParentName,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class TransactionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAllByUserId(
    userId: string,
    query: FindAllByUserIdQuery,
  ): Promise<FindAllByUserIdResult> {
    const categoryIdList =
      query.categoryId === undefined
        ? undefined
        : await this.getCategorySubtreeIds(userId, query.categoryId);

    const whereClause = and(...buildScopedConditions(userId, query, categoryIdList));

    const dataQuery = this.selectJoinedTransactions()
      .where(whereClause)
      .orderBy(...buildOrderBy(query.sortBy, query.sortOrder))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    const countQuery = this.db.select({ total: count() }).from(transactions).where(whereClause);

    const [rows, totalResult] = await Promise.all([dataQuery, countQuery]);

    return { data: rows.map(mapRowToResponse), total: totalResult[0]?.total ?? 0 };
  }

  private async getCategorySubtreeIds(userId: string, categoryId: string): Promise<string[]> {
    const result = await this.db.execute<{ id: string }>(sql`
      WITH RECURSIVE subtree AS (
        SELECT id, 1 AS depth
        FROM transaction_categories
        WHERE id = ${categoryId} AND user_id = ${userId}
        UNION ALL
        SELECT tc.id, s.depth + 1
        FROM transaction_categories tc
        INNER JOIN subtree s ON tc.parent_id = s.id
        WHERE tc.user_id = ${userId} AND s.depth < ${SUBTREE_MAX_DEPTH}
      )
      SELECT id FROM subtree
    `);

    return result.rows.map((row) => row.id);
  }

  async findOneByUserIdAndId(userId: string, id: string): Promise<TransactionResponseDto | null> {
    const rows = await this.selectJoinedTransactions()
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
      .limit(SINGLE_ROW_LIMIT);

    const [row] = rows;

    return row ? mapRowToResponse(row) : null;
  }

  async create(input: CreateTransactionInput): Promise<TransactionResponseDto> {
    const id = generateId();

    await this.db.insert(transactions).values({
      id,
      userId: input.userId,
      categoryId: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      note: input.note,
    });

    const created = await this.findOneByUserIdAndId(input.userId, id);

    if (!created) {
      throw new Error('Created transaction could not be loaded');
    }

    return created;
  }

  async updateScoped(
    userId: string,
    id: string,
    input: UpdateTransactionInput,
  ): Promise<TransactionResponseDto | null> {
    const updatedRows = await this.db
      .update(transactions)
      .set({
        categoryId: input.categoryId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        date: input.date,
        note: input.note,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
      .returning({ id: transactions.id });

    if (updatedRows.length === NO_ROWS_AFFECTED) {
      return null;
    }

    return this.findOneByUserIdAndId(userId, id);
  }

  async deleteScoped(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)));

    return (result.rowCount ?? NO_ROWS_AFFECTED) > NO_ROWS_AFFECTED;
  }

  async findCategoryForUser(userId: string, categoryId: string): Promise<ScopedCategory | null> {
    const rows = await this.db
      .select({ id: transactionCategories.id, type: transactionCategories.type })
      .from(transactionCategories)
      .where(
        and(eq(transactionCategories.userId, userId), eq(transactionCategories.id, categoryId)),
      )
      .limit(SINGLE_ROW_LIMIT);

    return rows[0] ?? null;
  }

  private selectJoinedTransactions() {
    return this.db
      .select(TRANSACTION_LIST_COLUMNS)
      .from(transactions)
      .leftJoin(
        transactionCategories,
        and(
          eq(transactions.userId, transactionCategories.userId),
          eq(transactions.categoryId, transactionCategories.id),
        ),
      )
      .leftJoin(
        parentCategory,
        and(
          eq(transactionCategories.parentId, parentCategory.id),
          eq(transactionCategories.userId, parentCategory.userId),
        ),
      );
  }
}
