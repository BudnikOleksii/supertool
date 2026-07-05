import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { TRANSACTION_EXPORT_FORMAT_LIST } from '@supertool/shared/constants/transaction-export';
import type { TransactionExportFormat } from '@supertool/shared/constants/transaction-export';

import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';
import { TransactionFilterQueryDto } from './transaction-filter-query.dto';

export class ExportTransactionsQueryDto extends TransactionFilterQueryDto {
  @ApiProperty({
    enum: TRANSACTION_EXPORT_FORMAT_LIST,
    enumName: OPENAPI_ENUM_NAME.transactionExportFormat,
  })
  @IsIn(TRANSACTION_EXPORT_FORMAT_LIST)
  format!: TransactionExportFormat;
}
