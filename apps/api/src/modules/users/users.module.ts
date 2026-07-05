import { Module } from '@nestjs/common';

import { AnalyticsCacheModule } from '../analytics/analytics-cache.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [AnalyticsCacheModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
