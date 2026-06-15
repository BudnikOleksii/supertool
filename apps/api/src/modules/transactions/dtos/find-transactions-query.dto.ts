import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '../../../shared/constants/transaction-validation';
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
}
