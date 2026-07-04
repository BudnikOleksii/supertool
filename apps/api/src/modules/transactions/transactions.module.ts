import { Module } from '@nestjs/common';

import { TransactionsImportService } from './transactions-import.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsImportService, TransactionsRepository],
})
export class TransactionsModule {}
