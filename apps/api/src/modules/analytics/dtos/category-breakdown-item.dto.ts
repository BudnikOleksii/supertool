import { ApiProperty } from '@nestjs/swagger';

export class CategoryBreakdownItemDto {
  @ApiProperty({ example: '0192f1a0-1c2d-7e3f-8a4b-5c6d7e8f9a0b' })
  categoryId!: string;

  @ApiProperty({ example: 'Groceries' })
  categoryName!: string;

  @ApiProperty({ type: 'string', example: '420.00' })
  total!: string;

  @ApiProperty({ type: 'number', example: 37.5 })
  share!: number;
}
