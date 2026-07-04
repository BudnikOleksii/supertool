import { ApiProperty } from '@nestjs/swagger';

export class DailySpendingDayDto {
  @ApiProperty({ example: '2025-02-15' })
  date!: string;

  @ApiProperty({ type: 'string', example: '45.99' })
  total!: string;

  @ApiProperty({ type: 'number', example: 3 })
  transactionCount!: number;
}
