import { Module } from '@nestjs/common';

import { AnalyticsCacheModule } from '../analytics/analytics-cache.module';
import { TransactionCategoriesController } from './transaction-categories.controller';
import { TransactionCategoriesRepository } from './transaction-categories.repository';
import { TransactionCategoriesService } from './transaction-categories.service';

@Module({
  imports: [AnalyticsCacheModule],
  controllers: [TransactionCategoriesController],
  providers: [TransactionCategoriesService, TransactionCategoriesRepository],
})
export class TransactionCategoriesModule {}
