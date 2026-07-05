import { ApiProperty } from '@nestjs/swagger';

import { ByCategoryNodeDto } from './by-category-node.dto';

export class ByCategoryResponseDto {
  @ApiProperty({ type: [ByCategoryNodeDto] })
  categories!: ByCategoryNodeDto[];

  @ApiProperty({ example: 'UAH' })
  currency!: string;
}
