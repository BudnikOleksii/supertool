import { ApiProperty } from '@nestjs/swagger';

import { TopCategoryItemDto } from './top-category-item.dto';

export class TopCategoriesResponseDto {
  @ApiProperty({ type: [TopCategoryItemDto] })
  categories!: TopCategoryItemDto[];

  @ApiProperty({ type: 'string', example: '1120.00' })
  totalExpense!: string;

  @ApiProperty({ example: 'UAH' })
  currency!: string;
}
