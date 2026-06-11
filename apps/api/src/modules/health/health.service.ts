import { Inject, Injectable } from '@nestjs/common';

import type { HealthResponseDto } from './dtos/health-response.dto';

import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(@Inject(HealthRepository) private readonly healthRepository: HealthRepository) {}

  async check(): Promise<HealthResponseDto> {
    try {
      await this.healthRepository.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
