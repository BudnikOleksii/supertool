import { ApiProperty } from '@nestjs/swagger';

import { NearDuplicateClusterDto } from './near-duplicate-cluster.dto';

export class TransactionImportResponseDto {
  @ApiProperty({ example: 1880 })
  inserted!: number;

  @ApiProperty({ example: 0 })
  skippedDuplicates!: number;

  @ApiProperty({ example: 14 })
  topLevelCategoriesCreated!: number;

  @ApiProperty({ example: 23 })
  childCategoriesCreated!: number;

  @ApiProperty({ type: [NearDuplicateClusterDto] })
  nearDuplicateClusterList!: NearDuplicateClusterDto[];
}
