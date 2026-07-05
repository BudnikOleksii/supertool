import { Injectable } from '@nestjs/common';

import { ANALYTICS_CACHE_TTL_MS } from '@supertool/shared/constants/analytics';
import type { ObjectValuesUnion } from '@supertool/shared/types/object-values-union';

export const ANALYTICS_ENDPOINT = {
  summary: 'summary',
  breakdown: 'breakdown',
  trend: 'trend',
  topCategories: 'top-categories',
  dailySpending: 'daily-spending',
  byCategory: 'by-category',
} as const;

export type AnalyticsEndpoint = ObjectValuesUnion<typeof ANALYTICS_ENDPOINT>;

interface AnalyticsCacheKeyParams {
  endpoint: AnalyticsEndpoint;
  dateFrom: string;
  dateTo: string;
  limit: number | undefined;
  currency: string;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export const getAnalyticsCacheKey = ({
  endpoint,
  dateFrom,
  dateTo,
  limit,
  currency,
}: AnalyticsCacheKeyParams): string =>
  `analytics:${endpoint}:${dateFrom}:${dateTo}:${limit ?? ''}:${currency}`;

@Injectable()
export class AnalyticsCacheService {
  private readonly store = new Map<string, Map<string, CacheEntry>>();

  async getOrCompute<T>(userId: string, key: string, compute: () => Promise<T>): Promise<T> {
    const liveEntry = this.readLiveEntry(userId, key);

    if (liveEntry !== undefined) {
      return structuredClone(liveEntry.value as T);
    }

    const value = await compute();
    this.writeEntry(userId, key, value);

    return structuredClone(value);
  }

  invalidateUser(userId: string): void {
    this.store.delete(userId);
  }

  private readLiveEntry(userId: string, key: string): CacheEntry | undefined {
    const userStore = this.store.get(userId);
    const entry = userStore?.get(key);

    if (entry === undefined) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      userStore?.delete(key);

      return undefined;
    }

    return entry;
  }

  private writeEntry(userId: string, key: string, value: unknown): void {
    const userStore = this.store.get(userId) ?? new Map<string, CacheEntry>();
    userStore.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
    });
    this.store.set(userId, userStore);
  }
}
