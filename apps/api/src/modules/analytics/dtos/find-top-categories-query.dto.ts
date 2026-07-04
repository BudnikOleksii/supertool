import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

import {
  TOP_CATEGORIES_MAX_LIMIT,
  TOP_CATEGORIES_MIN_LIMIT,
} from '@supertool/shared/constants/analytics';
import { CALENDAR_DATE_PATTERN } from '@supertool/shared/constants/transaction-validation';

import { IsOnOrAfter } from '../../../shared/validators/is-on-or-after.decorator';

export class FindTopCategoriesQueryDto {
  @ApiProperty({ example: '2025-02-01' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  dateFrom!: string;

  @ApiProperty({ example: '2025-02-28' })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN)
  @IsOnOrAfter('dateFrom')
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
