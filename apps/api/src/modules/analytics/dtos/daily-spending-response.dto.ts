import { ApiProperty } from '@nestjs/swagger';

import { DailySpendingDayDto } from './daily-spending-day.dto';

export class DailySpendingResponseDto {
  @ApiProperty({ type: [DailySpendingDayDto] })
  days!: DailySpendingDayDto[];

  @ApiProperty({ type: 'string', example: '1120.00' })
  totalExpense!: string;

  @ApiProperty({ example: 'UAH' })
  currency!: string;
}
