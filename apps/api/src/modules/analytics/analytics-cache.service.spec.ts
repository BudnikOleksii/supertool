import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_CACHE_TTL_MS } from '@supertool/shared/constants/analytics';

import { AnalyticsCacheService, getAnalyticsCacheKey } from './analytics-cache.service';

const KEY = 'analytics:summary:2025-02-01:2025-02-28::UAH';
const EXPECTED_TWO_CALLS = 2;

describe('getAnalyticsCacheKey', () => {
  it('builds a deterministic key from all inputs', () => {
    const key = getAnalyticsCacheKey({
      endpoint: 'summary',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: undefined,
      currency: 'UAH',
    });

    expect(key).toBe('analytics:summary:2025-02-01:2025-02-28::UAH');
  });

  it('includes the resolved limit only when provided', () => {
    const withLimit = getAnalyticsCacheKey({
      endpoint: 'top-categories',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: 5,
      currency: 'UAH',
    });

    expect(withLimit).toBe('analytics:top-categories:2025-02-01:2025-02-28:5:UAH');
  });

  it('produces a different key when the currency changes', () => {
    const uah = getAnalyticsCacheKey({
      endpoint: 'summary',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: undefined,
      currency: 'UAH',
    });
    const usd = getAnalyticsCacheKey({
      endpoint: 'summary',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      limit: undefined,
      currency: 'USD',
    });

    expect(uah).not.toBe(usd);
  });
});

describe('AnalyticsCacheService', () => {
  let service = new AnalyticsCacheService();

  beforeEach(() => {
    service = new AnalyticsCacheService();
  });

  it('computes and stores on a miss then serves a hit without recomputing', async () => {
    const compute = vi.fn().mockResolvedValue({ income: '10.00' });

    const first = await service.getOrCompute('user-a', KEY, compute);
    const second = await service.getOrCompute('user-a', KEY, compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ income: '10.00' });
    expect(second).toEqual({ income: '10.00' });
  });

  it('returns a distinct clone on every read so callers cannot mutate the cache', async () => {
    const compute = vi.fn().mockResolvedValue({ nested: { amount: '10.00' } });

    const first = await service.getOrCompute<{ nested: { amount: string } }>(
      'user-a',
      KEY,
      compute,
    );
    first.nested.amount = 'mutated';

    const second = await service.getOrCompute<{ nested: { amount: string } }>(
      'user-a',
      KEY,
      compute,
    );

    expect(second.nested.amount).toBe('10.00');
  });

  it('does not let the computed source object leak into the cache by reference', async () => {
    const source = { amount: '10.00' };
    const compute = vi.fn().mockResolvedValue(source);

    await service.getOrCompute('user-a', KEY, compute);
    source.amount = 'mutated';

    const cached = await service.getOrCompute<{ amount: string }>('user-a', KEY, compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(cached.amount).toBe('10.00');
  });

  it('recomputes after the TTL elapses', async () => {
    vi.useFakeTimers();
    const compute = vi.fn().mockResolvedValue({ income: '10.00' });

    await service.getOrCompute('user-a', KEY, compute);
    vi.advanceTimersByTime(ANALYTICS_CACHE_TTL_MS + 1);
    await service.getOrCompute('user-a', KEY, compute);

    expect(compute).toHaveBeenCalledTimes(EXPECTED_TWO_CALLS);
  });

  it('isolates users so one user cache is never served to another', async () => {
    const computeA = vi.fn().mockResolvedValue({ income: '10.00' });
    const computeB = vi.fn().mockResolvedValue({ income: '20.00' });

    const forA = await service.getOrCompute('user-a', KEY, computeA);
    const forB = await service.getOrCompute('user-b', KEY, computeB);

    expect(forA).toEqual({ income: '10.00' });
    expect(forB).toEqual({ income: '20.00' });
  });

  it('invalidates only the target user submap', async () => {
    const computeA = vi.fn().mockResolvedValue({ income: '10.00' });
    const computeB = vi.fn().mockResolvedValue({ income: '20.00' });

    await service.getOrCompute('user-a', KEY, computeA);
    await service.getOrCompute('user-b', KEY, computeB);

    service.invalidateUser('user-a');

    await service.getOrCompute('user-a', KEY, computeA);
    await service.getOrCompute('user-b', KEY, computeB);

    expect(computeA).toHaveBeenCalledTimes(EXPECTED_TWO_CALLS);
    expect(computeB).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
