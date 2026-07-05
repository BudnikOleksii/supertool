import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { ANALYTICS_MAX_RANGE_DAYS } from '@supertool/shared/constants/analytics';
import { CALENDAR_DATE_PATTERN } from '@supertool/shared/constants/transaction-validation';

import { IsBoundedDateRange } from '../../../shared/validators/is-bounded-date-range.decorator';
import { IsCalendarDate } from '../../../shared/validators/is-calendar-date.decorator';
import { IsOrderedDateRange } from '../../../shared/validators/is-ordered-date-range.decorator';

@IsOrderedDateRange('dateFrom', 'dateTo')
@IsBoundedDateRange('dateFrom', 'dateTo', ANALYTICS_MAX_RANGE_DAYS)
export class FindByCategoryQueryDto {
  @ApiProperty({ example: '2025-02-01' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  @IsCalendarDate()
  dateFrom!: string;

  @ApiProperty({ example: '2025-02-28' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  @IsCalendarDate()
  dateTo!: string;
}
