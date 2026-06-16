import { ApiProperty } from '@nestjs/swagger';

import { CategoryBreakdownItemDto } from './category-breakdown-item.dto';

export class CategoryBreakdownResponseDto {
  @ApiProperty({ type: [CategoryBreakdownItemDto] })
  breakdown!: CategoryBreakdownItemDto[];

  @ApiProperty({ type: 'string', example: '1120.00' })
  totalExpense!: string;

  @ApiProperty({ example: 'UAH' })
  currency!: string;
}
