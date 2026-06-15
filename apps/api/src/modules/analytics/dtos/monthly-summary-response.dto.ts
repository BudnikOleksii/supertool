import { ApiProperty } from '@nestjs/swagger';

export class MonthlySummaryResponseDto {
  @ApiProperty({ type: 'string', example: '1234.56' })
  income!: string;

  @ApiProperty({ type: 'string', example: '567.89' })
  expense!: string;

  @ApiProperty({ type: 'string', example: '666.67' })
  net!: string;

  @ApiProperty({ example: 'UAH' })
  currency!: string;
}
