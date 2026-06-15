import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  DEFAULT_PAGE_SIZE,
  FIRST_PAGE,
  MAX_PAGE,
  MAX_PAGE_SIZE,
} from '@supertool/shared/constants/pagination';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: FIRST_PAGE })
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_PAGE)
  @Max(MAX_PAGE)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_PAGE)
  @Max(MAX_PAGE_SIZE)
  @IsOptional()
  limit?: number;
}
