import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns the health report from the service', async () => {
    const check = vi.fn().mockResolvedValue({ status: 'ok', database: 'up' });
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check } }],
    }).compile();

    const controller = moduleRef.get(HealthController);

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
    expect(check).toHaveBeenCalledTimes(1);
  });
});
