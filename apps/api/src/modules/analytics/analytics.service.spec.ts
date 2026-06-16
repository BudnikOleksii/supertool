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
});
