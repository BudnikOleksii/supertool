import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { TRANSACTION_SEARCH_MAX_LENGTH } from '@supertool/shared/constants/transaction-search';

import { PaginationQueryDto } from '../../../shared/dtos/pagination-query.dto';
import { TransactionFilterQueryDto } from './transaction-filter-query.dto';

export class FindTransactionsQueryDto extends IntersectionType(
  PaginationQueryDto,
  TransactionFilterQueryDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_SEARCH_MAX_LENGTH)
  search?: string;
}
