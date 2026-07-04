import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { Database } from '../../database/database.types';
import type { CategoryBreakdownResponseDto } from './dtos/category-breakdown-response.dto';
import type { DailySpendingResponseDto } from './dtos/daily-spending-response.dto';
import type { MonthlySummaryResponseDto } from './dtos/monthly-summary-response.dto';
import type { TopCategoriesResponseDto } from './dtos/top-categories-response.dto';
import type { TrendResponseDto } from './dtos/trend-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { transactionTypeEnum } from '../../database/schemas/enums';
import { transactions } from '../../database/schemas/transactions';

const [INCOME_TYPE, EXPENSE_TYPE] = transactionTypeEnum.enumValues;

const MONEY_PRECISION = 14;
const MONEY_SCALE = 2;
const ZERO_AMOUNT = '0.00';

const moneyCast = (): ReturnType<typeof sql.raw> =>
  sql.raw(`::numeric(${MONEY_PRECISION}, ${MONEY_SCALE})::text`);

interface MonthlySummaryQuery {
  userId: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
}

interface CategoryBreakdownQuery {
  userId: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
}

interface MonthlyTrendQuery {
  userId: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
}

interface TopCategoriesQuery {
  userId: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
}

interface DailySpendingQuery {
  userId: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
}

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getMonthlySummary(query: MonthlySummaryQuery): Promise<MonthlySummaryResponseDto> {
    const result = await this.db.execute<{ income: string; expense: string; net: string }>(sql`
      SELECT
        COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type}::text = ${INCOME_TYPE}), 0)::numeric(${sql.raw(String(MONEY_PRECISION))}, ${sql.raw(String(MONEY_SCALE))})::text AS income,
        COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type}::text = ${EXPENSE_TYPE}), 0)::numeric(${sql.raw(String(MONEY_PRECISION))}, ${sql.raw(String(MONEY_SCALE))})::text AS expense,
        (
          COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type}::text = ${INCOME_TYPE}), 0)
          - COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type}::text = ${EXPENSE_TYPE}), 0)
        )::numeric(${sql.raw(String(MONEY_PRECISION))}, ${sql.raw(String(MONEY_SCALE))})::text AS net
      FROM ${transactions}
      WHERE ${transactions.userId} = ${query.userId}
        AND ${transactions.currency} = ${query.currency}
        AND ${transactions.date} >= ${query.dateFrom}
        AND ${transactions.date} <= ${query.dateTo}
    `);

    const [row] = result.rows;

    return {
      income: row?.income ?? ZERO_AMOUNT,
      expense: row?.expense ?? ZERO_AMOUNT,
      net: row?.net ?? ZERO_AMOUNT,
      currency: query.currency,
    };
  }

  async getCategoryBreakdown(query: CategoryBreakdownQuery): Promise<CategoryBreakdownResponseDto> {
    const result = await this.db.execute<{
      categoryId: string;
      categoryName: string;
      total: string;
      totalExpense: string;
      share: number;
    }>(sql`
      WITH RECURSIVE category_roots AS (
        SELECT id, id AS root_id, name AS root_name
        FROM transaction_categories
        WHERE user_id = ${query.userId} AND parent_id IS NULL
        UNION ALL
        SELECT tc.id, cr.root_id, cr.root_name
        FROM transaction_categories tc
        INNER JOIN category_roots cr ON tc.parent_id = cr.id
        WHERE tc.user_id = ${query.userId}
      )
      SELECT
        cr.root_id   AS "categoryId",
        cr.root_name AS "categoryName",
        SUM(t.amount)${moneyCast()} AS total,
        (SUM(SUM(t.amount)) OVER ())${moneyCast()} AS "totalExpense",
        (SUM(t.amount) / NULLIF(SUM(SUM(t.amount)) OVER (), 0) * 100)::float8 AS share
      FROM transactions t
      INNER JOIN category_roots cr ON cr.id = t.category_id
      WHERE t.user_id = ${query.userId}
        AND t.currency = ${query.currency}
        AND t.type::text = ${EXPENSE_TYPE}
        AND t.date >= ${query.dateFrom}
        AND t.date <= ${query.dateTo}
      GROUP BY cr.root_id, cr.root_name
      ORDER BY SUM(t.amount) DESC
    `);

    const breakdownList = result.rows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      total: row.total,
      share: row.share,
    }));

    const [firstRow] = result.rows;

    return {
      breakdown: breakdownList,
      totalExpense: firstRow?.totalExpense ?? ZERO_AMOUNT,
      currency: query.currency,
    };
  }

  async getMonthlyTrend(query: MonthlyTrendQuery): Promise<TrendResponseDto> {
    const result = await this.db.execute<{ month: string; income: string; expense: string }>(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${query.dateFrom}::date),
          date_trunc('month', ${query.dateTo}::date),
          interval '1 month'
        )::date AS month_start
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') AS month,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type::text = ${INCOME_TYPE}), 0)${moneyCast()} AS income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type::text = ${EXPENSE_TYPE}), 0)${moneyCast()} AS expense
      FROM months m
      LEFT JOIN transactions t
        ON date_trunc('month', t.date)::date = m.month_start
        AND t.user_id = ${query.userId}
        AND t.currency = ${query.currency}
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `);

    return {
      trend: result.rows,
      currency: query.currency,
    };
  }

  async getTopCategories(query: TopCategoriesQuery): Promise<TopCategoriesResponseDto> {
    const result = await this.db.execute<{
      categoryId: string;
      categoryName: string;
      total: string;
      totalExpense: string;
      share: number;
      transactionCount: number;
    }>(sql`
      WITH RECURSIVE category_roots AS (
        SELECT id, id AS root_id, name AS root_name
        FROM transaction_categories
        WHERE user_id = ${query.userId} AND parent_id IS NULL
        UNION ALL
        SELECT tc.id, cr.root_id, cr.root_name
        FROM transaction_categories tc
        INNER JOIN category_roots cr ON tc.parent_id = cr.id
        WHERE tc.user_id = ${query.userId}
      )
      SELECT
        cr.root_id   AS "categoryId",
        cr.root_name AS "categoryName",
        SUM(t.amount)${moneyCast()} AS total,
        (SUM(SUM(t.amount)) OVER ())${moneyCast()} AS "totalExpense",
        (SUM(t.amount) / NULLIF(SUM(SUM(t.amount)) OVER (), 0) * 100)::float8 AS share,
        COUNT(t.id)::int AS "transactionCount"
      FROM transactions t
      INNER JOIN category_roots cr ON cr.id = t.category_id
      WHERE t.user_id = ${query.userId}
        AND t.currency = ${query.currency}
        AND t.type::text = ${EXPENSE_TYPE}
        AND t.date >= ${query.dateFrom}
        AND t.date <= ${query.dateTo}
      GROUP BY cr.root_id, cr.root_name
      ORDER BY SUM(t.amount) DESC
      LIMIT ${query.limit}
    `);

    const categoryList = result.rows.map((row, index) => ({
      rank: index + 1,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      total: row.total,
      share: row.share,
      transactionCount: row.transactionCount,
    }));

    const [firstRow] = result.rows;

    return {
      categories: categoryList,
      totalExpense: firstRow?.totalExpense ?? ZERO_AMOUNT,
      currency: query.currency,
    };
  }

  async getDailySpending(query: DailySpendingQuery): Promise<DailySpendingResponseDto> {
    const result = await this.db.execute<{
      date: string;
      total: string;
      totalExpense: string;
      transactionCount: number;
    }>(sql`
      WITH days AS (
        SELECT generate_series(
          ${query.dateFrom}::date,
          ${query.dateTo}::date,
          interval '1 day'
        )::date AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(t.amount), 0)${moneyCast()} AS total,
        COALESCE(SUM(SUM(t.amount)) OVER (), 0)${moneyCast()} AS "totalExpense",
        COUNT(t.id)::int AS "transactionCount"
      FROM days d
      LEFT JOIN transactions t
        ON t.date = d.day
        AND t.user_id = ${query.userId}
        AND t.currency = ${query.currency}
        AND t.type::text = ${EXPENSE_TYPE}
      GROUP BY d.day
      ORDER BY d.day ASC
    `);

    const dayList = result.rows.map((row) => ({
      date: row.date,
      total: row.total,
      transactionCount: row.transactionCount,
    }));

    const [firstRow] = result.rows;

    return {
      days: dayList,
      totalExpense: firstRow?.totalExpense ?? ZERO_AMOUNT,
      currency: query.currency,
    };
  }
}
