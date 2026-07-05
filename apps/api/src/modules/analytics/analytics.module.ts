import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AnalyticsCacheModule } from './analytics-cache.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [UsersModule, AnalyticsCacheModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}
