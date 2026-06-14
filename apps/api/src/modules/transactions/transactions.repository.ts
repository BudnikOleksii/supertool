import type { SQL } from 'drizzle-orm';

import { Inject, Injectable } from '@nestjs/common';
import { aliasedTable, and, count, desc, eq, gte, lte } from 'drizzle-orm';

import type { Database } from '../../database/database.types';
import type { TransactionResponseDto } from './dtos/transaction-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { transactionCategories } from '../../database/schemas/transaction-categories';
import { transactions } from '../../database/schemas/transactions';

interface FindAllByUserIdQuery {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page: number;
  limit: number;
}

interface FindAllByUserIdResult {
  data: TransactionResponseDto[];
  total: number;
}

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

const buildScopedConditions = (userId: string, query: FindAllByUserIdQuery): SQL[] => {
  const conditions: SQL[] = [eq(transactions.userId, userId)];

  if (query.dateFrom !== undefined) {
    conditions.push(gte(transactions.date, query.dateFrom));
  }

  if (query.dateTo !== undefined) {
    conditions.push(lte(transactions.date, query.dateTo));
  }

  return conditions;
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
    const whereClause = and(...buildScopedConditions(userId, query));

    const dataQuery = this.db
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
      )
      .where(whereClause)
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    const countQuery = this.db.select({ total: count() }).from(transactions).where(whereClause);

    const [rows, totalResult] = await Promise.all([dataQuery, countQuery]);

    return { data: rows.map(mapRowToResponse), total: totalResult[0]?.total ?? 0 };
  }
}
