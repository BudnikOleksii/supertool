import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '@supertool/shared/constants/transaction-validation';

import { IsOnOrAfter } from '../../../shared/validators/is-on-or-after.decorator';

export class FindTrendQueryDto {
  @ApiProperty({ example: '2024-03-01' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  dateFrom!: string;

  @ApiProperty({ example: '2025-02-28' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  @IsOnOrAfter('dateFrom')
  dateTo!: string;
}
