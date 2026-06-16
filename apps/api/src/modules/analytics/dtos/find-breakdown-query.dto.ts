import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '../../../shared/constants/transaction-validation';

export class FindBreakdownQueryDto {
  @ApiProperty({ example: '2025-02-01' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  dateFrom!: string;

  @ApiProperty({ example: '2025-02-28' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  dateTo!: string;
}
