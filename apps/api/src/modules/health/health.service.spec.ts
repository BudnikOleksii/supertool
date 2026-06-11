import { describe, expect, it, vi } from 'vitest';

import type { HealthRepository } from './health.repository';

import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports ok/up when the database ping succeeds', async () => {
    const repository = { ping: vi.fn().mockResolvedValue(undefined) };
    const service = new HealthService(repository as unknown as HealthRepository);

    await expect(service.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports degraded/down when the database ping fails', async () => {
    const repository = { ping: vi.fn().mockRejectedValue(new Error('connection refused')) };
    const service = new HealthService(repository as unknown as HealthRepository);

    await expect(service.check()).resolves.toEqual({ status: 'degraded', database: 'down' });
  });
});
