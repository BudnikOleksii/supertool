import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

import {
  TOP_CATEGORIES_MAX_LIMIT,
  TOP_CATEGORIES_MIN_LIMIT,
} from '@supertool/shared/constants/analytics';
import { CALENDAR_DATE_PATTERN } from '@supertool/shared/constants/transaction-validation';

import { IsCalendarDate } from '../../../shared/validators/is-calendar-date.decorator';
import { IsOrderedDateRange } from '../../../shared/validators/is-ordered-date-range.decorator';

@IsOrderedDateRange('dateFrom', 'dateTo')
export class FindTopCategoriesQueryDto {
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

  @ApiPropertyOptional({
    example: 5,
    minimum: TOP_CATEGORIES_MIN_LIMIT,
    maximum: TOP_CATEGORIES_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(TOP_CATEGORIES_MIN_LIMIT)
  @Max(TOP_CATEGORIES_MAX_LIMIT)
  limit?: number;
}
