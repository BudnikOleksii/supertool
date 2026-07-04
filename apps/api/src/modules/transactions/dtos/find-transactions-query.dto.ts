import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

import {
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  TRANSACTION_SORT_BY_LIST,
  TRANSACTION_SORT_ORDER_LIST,
} from '@supertool/shared/constants/transaction-sort';
import type {
  TransactionSortBy,
  TransactionSortOrder,
} from '@supertool/shared/constants/transaction-sort';
import { CALENDAR_DATE_PATTERN } from '@supertool/shared/constants/transaction-validation';

import type { TransactionType } from '../../../database/schemas/enums';

import { TRANSACTION_TYPE_LIST, transactionTypeEnum } from '../../../database/schemas/enums';
import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';
import { PaginationQueryDto } from '../../../shared/dtos/pagination-query.dto';

export class FindTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-02-01' })
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2025-02-28' })
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN)
  dateTo?: string;

  @ApiPropertyOptional({
    enum: transactionTypeEnum.enumValues,
    enumName: OPENAPI_ENUM_NAME.transactionType,
  })
  @IsOptional()
  @IsIn(TRANSACTION_TYPE_LIST)
  type?: TransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: TRANSACTION_SORT_BY_LIST,
    enumName: OPENAPI_ENUM_NAME.transactionSortBy,
    default: DEFAULT_SORT_BY,
  })
  @IsOptional()
  @IsIn(TRANSACTION_SORT_BY_LIST)
  sortBy?: TransactionSortBy;

  @ApiPropertyOptional({
    enum: TRANSACTION_SORT_ORDER_LIST,
    enumName: OPENAPI_ENUM_NAME.sortOrder,
    default: DEFAULT_SORT_ORDER,
  })
  @IsOptional()
  @IsIn(TRANSACTION_SORT_ORDER_LIST)
  sortOrder?: TransactionSortOrder;
}
