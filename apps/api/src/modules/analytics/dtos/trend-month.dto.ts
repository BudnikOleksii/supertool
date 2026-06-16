import { ApiProperty } from '@nestjs/swagger';

export class TrendMonthDto {
  @ApiProperty({ example: '2025-02' })
  month!: string;

  @ApiProperty({ type: 'string', example: '1234.56' })
  income!: string;

  @ApiProperty({ type: 'string', example: '567.89' })
  expense!: string;
}
