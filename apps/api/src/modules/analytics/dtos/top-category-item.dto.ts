import { ApiProperty } from '@nestjs/swagger';

export class TopCategoryItemDto {
  @ApiProperty({ type: 'number', example: 1 })
  rank!: number;

  @ApiProperty({ example: '0192f1a0-1c2d-7e3f-8a4b-5c6d7e8f9a0b' })
  categoryId!: string;

  @ApiProperty({ example: 'Groceries' })
  categoryName!: string;

  @ApiProperty({ type: 'string', example: '450.25' })
  total!: string;

  @ApiProperty({ type: 'number', example: 28.5 })
  share!: number;

  @ApiProperty({ type: 'number', example: 12 })
  transactionCount!: number;
}
