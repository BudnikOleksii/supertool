import { describe, expect, it, vi } from 'vitest';

import type { UsersRepository } from '../users/users.repository';
import type { AnalyticsRepository } from './analytics.repository';

import { AnalyticsService } from './analytics.service';

const buildQuery = (): { dateFrom: string; dateTo: string } => ({
  dateFrom: '2025-02-01',
  dateTo: '2025-02-28',
});

const buildAnalyticsService = (
  analyticsRepository: Partial<AnalyticsRepository>,
  usersRepository: Partial<UsersRepository>,
): AnalyticsService =>
  new AnalyticsService(
    analyticsRepository as unknown as AnalyticsRepository,
    usersRepository as unknown as UsersRepository,
  );

describe('AnalyticsService', () => {
  it('scopes the summary to the user default currency and forwards the date window', async () => {
    const expectedSummary = {
      income: '300.00',
      expense: '120.50',
      net: '179.50',
      currency: 'UAH',
    };
    const getMonthlySummary = vi.fn().mockResolvedValue(expectedSummary);
    const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
    const service = buildAnalyticsService({ getMonthlySummary }, { findByIdScoped });

    const actual = await service.getMonthlySummary('user-id', buildQuery());

    expect(findByIdScoped).toHaveBeenCalledWith('user-id');
    expect(getMonthlySummary).toHaveBeenCalledWith({
      userId: 'user-id',
      currency: 'UAH',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
    });
    expect(actual).toEqual(expectedSummary);
  });

  it('returns zero figures without querying when the user has no default currency', async () => {
    const getMonthlySummary = vi.fn();
    const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: null });
    const service = buildAnalyticsService({ getMonthlySummary }, { findByIdScoped });

    const actual = await service.getMonthlySummary('user-id', buildQuery());

    expect(actual).toEqual({ income: '0.00', expense: '0.00', net: '0.00', currency: '' });
    expect(getMonthlySummary).not.toHaveBeenCalled();
  });

  it('returns zero figures when the user cannot be found', async () => {
    const getMonthlySummary = vi.fn();
    const findByIdScoped = vi.fn().mockResolvedValue(undefined);
    const service = buildAnalyticsService({ getMonthlySummary }, { findByIdScoped });

    const actual = await service.getMonthlySummary('user-id', buildQuery());

    expect(actual).toEqual({ income: '0.00', expense: '0.00', net: '0.00', currency: '' });
    expect(getMonthlySummary).not.toHaveBeenCalled();
  });

  it('scopes the breakdown to the user default currency and forwards the date window', async () => {
    const expectedBreakdown = {
      breakdown: [{ categoryId: 'cat-1', categoryName: 'Groceries', total: '120.50', share: 100 }],
      totalExpense: '120.50',
      currency: 'UAH',
    };
    const getCategoryBreakdown = vi.fn().mockResolvedValue(expectedBreakdown);
    const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
    const service = buildAnalyticsService({ getCategoryBreakdown }, { findByIdScoped });

    const actual = await service.getCategoryBreakdown('user-id', buildQuery());

    expect(findByIdScoped).toHaveBeenCalledWith('user-id');
    expect(getCategoryBreakdown).toHaveBeenCalledWith({
      userId: 'user-id',
      currency: 'UAH',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
    });
    expect(actual).toEqual(expectedBreakdown);
  });

  it('returns an empty breakdown without querying when the user has no default currency', async () => {
    const getCategoryBreakdown = vi.fn();
    const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: null });
    const service = buildAnalyticsService({ getCategoryBreakdown }, { findByIdScoped });

    const actual = await service.getCategoryBreakdown('user-id', buildQuery());

    expect(actual).toEqual({ breakdown: [], totalExpense: '0.00', currency: '' });
    expect(getCategoryBreakdown).not.toHaveBeenCalled();
  });

  it('scopes the trend to the user default currency and forwards the date window', async () => {
    const expectedTrend = {
      trend: [
        { month: '2025-01', income: '300.00', expense: '120.50' },
        { month: '2025-02', income: '0.00', expense: '0.00' },
      ],
      currency: 'UAH',
    };
    const getMonthlyTrend = vi.fn().mockResolvedValue(expectedTrend);
    const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
    const service = buildAnalyticsService({ getMonthlyTrend }, { findByIdScoped });

    const actual = await service.getMonthlyTrend('user-id', {
      dateFrom: '2024-03-01',
      dateTo: '2025-02-28',
    });

    expect(findByIdScoped).toHaveBeenCalledWith('user-id');
    expect(getMonthlyTrend).toHaveBeenCalledWith({
      userId: 'user-id',
      currency: 'UAH',
      dateFrom: '2024-03-01',
      dateTo: '2025-02-28',
    });
    expect(actual).toEqual(expectedTrend);
  });

  it('returns an empty trend without querying when the user has no default currency', async () => {
    const getMonthlyTrend = vi.fn();
    const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: null });
    const service = buildAnalyticsService({ getMonthlyTrend }, { findByIdScoped });

    const actual = await service.getMonthlyTrend('user-id', {
      dateFrom: '2024-03-01',
      dateTo: '2025-02-28',
    });

    expect(actual).toEqual({ trend: [], currency: '' });
    expect(getMonthlyTrend).not.toHaveBeenCalled();
  });

  describe('top categories and daily spending', () => {
    it('scopes top categories to the default currency and applies the default limit', async () => {
      const expectedTopCategories = {
        categories: [
          {
            rank: 1,
            categoryId: 'cat-1',
            categoryName: 'Food',
            total: '120.50',
            share: 100,
            transactionCount: 3,
          },
        ],
        totalExpense: '120.50',
        currency: 'UAH',
      };
      const getTopCategories = vi.fn().mockResolvedValue(expectedTopCategories);
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
      const service = buildAnalyticsService({ getTopCategories }, { findByIdScoped });

      const actual = await service.getTopCategories('user-id', buildQuery());

      expect(findByIdScoped).toHaveBeenCalledWith('user-id');
      expect(getTopCategories).toHaveBeenCalledWith({
        userId: 'user-id',
        currency: 'UAH',
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
        limit: 5,
      });
      expect(actual).toEqual(expectedTopCategories);
    });

    it('forwards an explicit top categories limit to the repository', async () => {
      const getTopCategories = vi.fn().mockResolvedValue({
        categories: [],
        totalExpense: '0.00',
        currency: 'UAH',
      });
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
      const service = buildAnalyticsService({ getTopCategories }, { findByIdScoped });

      await service.getTopCategories('user-id', { ...buildQuery(), limit: 3 });

      expect(getTopCategories).toHaveBeenCalledWith({
        userId: 'user-id',
        currency: 'UAH',
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
        limit: 3,
      });
    });

    it('returns empty top categories without querying when the user has no default currency', async () => {
      const getTopCategories = vi.fn();
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: null });
      const service = buildAnalyticsService({ getTopCategories }, { findByIdScoped });

      const actual = await service.getTopCategories('user-id', buildQuery());

      expect(actual).toEqual({ categories: [], totalExpense: '0.00', currency: '' });
      expect(getTopCategories).not.toHaveBeenCalled();
    });

    it('scopes daily spending to the default currency and forwards the date window', async () => {
      const expectedDailySpending = {
        days: [{ date: '2025-02-01', total: '45.99', transactionCount: 2 }],
        totalExpense: '45.99',
        currency: 'UAH',
      };
      const getDailySpending = vi.fn().mockResolvedValue(expectedDailySpending);
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
      const service = buildAnalyticsService({ getDailySpending }, { findByIdScoped });

      const actual = await service.getDailySpending('user-id', buildQuery());

      expect(findByIdScoped).toHaveBeenCalledWith('user-id');
      expect(getDailySpending).toHaveBeenCalledWith({
        userId: 'user-id',
        currency: 'UAH',
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
      });
      expect(actual).toEqual(expectedDailySpending);
    });

    it('returns empty daily spending without querying when the user has no default currency', async () => {
      const getDailySpending = vi.fn();
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: null });
      const service = buildAnalyticsService({ getDailySpending }, { findByIdScoped });

      const actual = await service.getDailySpending('user-id', buildQuery());

      expect(actual).toEqual({ days: [], totalExpense: '0.00', currency: '' });
      expect(getDailySpending).not.toHaveBeenCalled();
    });
  });

  describe('by category', () => {
    it('scopes the by-category totals to the default currency and forwards the date window', async () => {
      const expectedByCategory = {
        categories: [
          {
            categoryId: 'cat-1',
            categoryName: 'Food',
            parentId: null,
            type: 'expense',
            total: '120.50',
            transactionCount: 3,
          },
        ],
        currency: 'UAH',
      };
      const getByCategoryTotals = vi.fn().mockResolvedValue(expectedByCategory);
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: 'UAH' });
      const service = buildAnalyticsService({ getByCategoryTotals }, { findByIdScoped });

      const actual = await service.getByCategory('user-id', buildQuery());

      expect(findByIdScoped).toHaveBeenCalledWith('user-id');
      expect(getByCategoryTotals).toHaveBeenCalledWith({
        userId: 'user-id',
        currency: 'UAH',
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
      });
      expect(actual).toEqual(expectedByCategory);
    });

    it('returns empty categories without querying when the user has no default currency', async () => {
      const getByCategoryTotals = vi.fn();
      const findByIdScoped = vi.fn().mockResolvedValue({ defaultCurrency: null });
      const service = buildAnalyticsService({ getByCategoryTotals }, { findByIdScoped });

      const actual = await service.getByCategory('user-id', buildQuery());

      expect(actual).toEqual({ categories: [], currency: '' });
      expect(getByCategoryTotals).not.toHaveBeenCalled();
    });
  });
});
