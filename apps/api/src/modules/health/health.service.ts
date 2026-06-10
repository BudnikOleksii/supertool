import { Injectable } from '@nestjs/common';

import type { HealthResponseDto } from './dtos/health-response.dto';

import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  /** Reports API liveness plus database connectivity; never throws (AC 2 — the endpoint reports, it doesn't crash). */
  async check(): Promise<HealthResponseDto> {
    try {
      await this.healthRepository.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
