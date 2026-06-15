import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { auth } from '../../auth/auth';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

const createSession = (userId: string): UserSession<typeof auth> =>
  ({ user: { id: userId } }) as unknown as UserSession<typeof auth>;

describe('AnalyticsController', () => {
  it('forwards the session user id and query to the service', async () => {
    const expectedResult = { income: '300.00', expense: '120.50', net: '179.50', currency: 'UAH' };
    const getMonthlySummary = vi.fn().mockResolvedValue(expectedResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: { getMonthlySummary } }],
    }).compile();

    const controller = moduleRef.get(AnalyticsController);
    const inputQuery = { dateFrom: '2025-02-01', dateTo: '2025-02-28' };

    await expect(
      controller.getMonthlySummary(createSession('user-id'), inputQuery),
    ).resolves.toEqual(expectedResult);
    expect(getMonthlySummary).toHaveBeenCalledWith('user-id', inputQuery);
  });
});
