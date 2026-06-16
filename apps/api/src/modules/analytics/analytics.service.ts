import { Inject, Injectable } from '@nestjs/common';

import { NO_CURRENCY } from '@supertool/shared/constants/currency';

import type { CategoryBreakdownResponseDto } from './dtos/category-breakdown-response.dto';
import type { FindBreakdownQueryDto } from './dtos/find-breakdown-query.dto';
import type { FindSummaryQueryDto } from './dtos/find-summary-query.dto';
import type { FindTrendQueryDto } from './dtos/find-trend-query.dto';
import type { MonthlySummaryResponseDto } from './dtos/monthly-summary-response.dto';
import type { TrendResponseDto } from './dtos/trend-response.dto';

import { UsersRepository } from '../users/users.repository';
import { AnalyticsRepository } from './analytics.repository';

const ZERO_AMOUNT = '0.00';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(AnalyticsRepository) private readonly analyticsRepository: AnalyticsRepository,
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  async getMonthlySummary(
    userId: string,
    query: FindSummaryQueryDto,
  ): Promise<MonthlySummaryResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { income: ZERO_AMOUNT, expense: ZERO_AMOUNT, net: ZERO_AMOUNT, currency: NO_CURRENCY };
    }

    return this.analyticsRepository.getMonthlySummary({
      userId,
      currency,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  async getCategoryBreakdown(
    userId: string,
    query: FindBreakdownQueryDto,
  ): Promise<CategoryBreakdownResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { breakdown: [], totalExpense: ZERO_AMOUNT, currency: NO_CURRENCY };
    }

    return this.analyticsRepository.getCategoryBreakdown({
      userId,
      currency,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  async getMonthlyTrend(userId: string, query: FindTrendQueryDto): Promise<TrendResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { trend: [], currency: NO_CURRENCY };
    }

    return this.analyticsRepository.getMonthlyTrend({
      userId,
      currency,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }
}
