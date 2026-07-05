import { Module } from '@nestjs/common';

import { AnalyticsCacheService } from './analytics-cache.service';

@Module({
  providers: [AnalyticsCacheService],
  exports: [AnalyticsCacheService],
})
export class AnalyticsCacheModule {}
