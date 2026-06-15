import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { Database } from '../../database/database.types';
import type { MonthlySummaryResponseDto } from './dtos/monthly-summary-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { transactionTypeEnum } from '../../database/schemas/enums';
import { transactions } from '../../database/schemas/transactions';

const [INCOME_TYPE, EXPENSE_TYPE] = transactionTypeEnum.enumValues;

const MONEY_PRECISION = 14;
const MONEY_SCALE = 2;
const ZERO_AMOUNT = '0.00';

interface MonthlySummaryQuery {
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
}
