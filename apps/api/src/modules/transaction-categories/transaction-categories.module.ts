import { Module } from '@nestjs/common';

import { TransactionCategoriesController } from './transaction-categories.controller';
import { TransactionCategoriesRepository } from './transaction-categories.repository';
import { TransactionCategoriesService } from './transaction-categories.service';

@Module({
  controllers: [TransactionCategoriesController],
  providers: [TransactionCategoriesService, TransactionCategoriesRepository],
})
export class TransactionCategoriesModule {}
