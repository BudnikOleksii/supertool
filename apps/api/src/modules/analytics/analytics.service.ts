import { Inject, Injectable } from '@nestjs/common';

import { TOP_CATEGORIES_DEFAULT_LIMIT } from '@supertool/shared/constants/analytics';
import { NO_CURRENCY } from '@supertool/shared/constants/currency';

import type { ByCategoryResponseDto } from './dtos/by-category-response.dto';
import type { CategoryBreakdownResponseDto } from './dtos/category-breakdown-response.dto';
import type { DailySpendingResponseDto } from './dtos/daily-spending-response.dto';
import type { FindBreakdownQueryDto } from './dtos/find-breakdown-query.dto';
import type { FindByCategoryQueryDto } from './dtos/find-by-category-query.dto';
import type { FindDailySpendingQueryDto } from './dtos/find-daily-spending-query.dto';
import type { FindSummaryQueryDto } from './dtos/find-summary-query.dto';
import type { FindTopCategoriesQueryDto } from './dtos/find-top-categories-query.dto';
import type { FindTrendQueryDto } from './dtos/find-trend-query.dto';
import type { MonthlySummaryResponseDto } from './dtos/monthly-summary-response.dto';
import type { TopCategoriesResponseDto } from './dtos/top-categories-response.dto';
import type { TrendResponseDto } from './dtos/trend-response.dto';

import { UsersRepository } from '../users/users.repository';
import { AnalyticsCacheService, getAnalyticsCacheKey } from './analytics-cache.service';
import { AnalyticsRepository } from './analytics.repository';

const ZERO_AMOUNT = '0.00';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(AnalyticsRepository) private readonly analyticsRepository: AnalyticsRepository,
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
    @Inject(AnalyticsCacheService) private readonly analyticsCache: AnalyticsCacheService,
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

    return this.analyticsCache.getOrCompute(
      userId,
      getAnalyticsCacheKey({
        endpoint: 'summary',
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: undefined,
        currency,
      }),
      () =>
        this.analyticsRepository.getMonthlySummary({
          userId,
          currency,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        }),
    );
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

    return this.analyticsCache.getOrCompute(
      userId,
      getAnalyticsCacheKey({
        endpoint: 'breakdown',
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: undefined,
        currency,
      }),
      () =>
        this.analyticsRepository.getCategoryBreakdown({
          userId,
          currency,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        }),
    );
  }

  async getMonthlyTrend(userId: string, query: FindTrendQueryDto): Promise<TrendResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { trend: [], currency: NO_CURRENCY };
    }

    return this.analyticsCache.getOrCompute(
      userId,
      getAnalyticsCacheKey({
        endpoint: 'trend',
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: undefined,
        currency,
      }),
      () =>
        this.analyticsRepository.getMonthlyTrend({
          userId,
          currency,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        }),
    );
  }

  async getTopCategories(
    userId: string,
    query: FindTopCategoriesQueryDto,
  ): Promise<TopCategoriesResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { categories: [], totalExpense: ZERO_AMOUNT, currency: NO_CURRENCY };
    }

    const limit = query.limit ?? TOP_CATEGORIES_DEFAULT_LIMIT;

    return this.analyticsCache.getOrCompute(
      userId,
      getAnalyticsCacheKey({
        endpoint: 'top-categories',
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit,
        currency,
      }),
      () =>
        this.analyticsRepository.getTopCategories({
          userId,
          currency,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          limit,
        }),
    );
  }

  async getDailySpending(
    userId: string,
    query: FindDailySpendingQueryDto,
  ): Promise<DailySpendingResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { days: [], totalExpense: ZERO_AMOUNT, currency: NO_CURRENCY };
    }

    return this.analyticsCache.getOrCompute(
      userId,
      getAnalyticsCacheKey({
        endpoint: 'daily-spending',
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: undefined,
        currency,
      }),
      () =>
        this.analyticsRepository.getDailySpending({
          userId,
          currency,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        }),
    );
  }

  async getByCategory(
    userId: string,
    query: FindByCategoryQueryDto,
  ): Promise<ByCategoryResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);
    const currency = user?.defaultCurrency ?? null;

    if (currency === null) {
      return { categories: [], currency: NO_CURRENCY };
    }

    return this.analyticsCache.getOrCompute(
      userId,
      getAnalyticsCacheKey({
        endpoint: 'by-category',
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: undefined,
        currency,
      }),
      () =>
        this.analyticsRepository.getByCategoryTotals({
          userId,
          currency,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        }),
    );
  }
}
