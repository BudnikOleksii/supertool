import { ApiProperty } from '@nestjs/swagger';

import { TrendMonthDto } from './trend-month.dto';

export class TrendResponseDto {
  @ApiProperty({ type: [TrendMonthDto] })
  trend!: TrendMonthDto[];

  @ApiProperty({ example: 'UAH' })
  currency!: string;
}
