import { Module } from '@nestjs/common';

import { AnalyticsCacheModule } from '../analytics/analytics-cache.module';
import { TransactionsImportService } from './transactions-import.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [AnalyticsCacheModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsImportService, TransactionsRepository],
})
export class TransactionsModule {}
