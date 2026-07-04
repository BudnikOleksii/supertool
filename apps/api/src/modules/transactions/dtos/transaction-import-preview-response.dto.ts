import { ApiProperty } from '@nestjs/swagger';

import { NearDuplicateClusterDto } from './near-duplicate-cluster.dto';

export class TransactionImportPreviewResponseDto {
  @ApiProperty({ example: 1880 })
  totalRows!: number;

  @ApiProperty({ example: 1880 })
  newRows!: number;

  @ApiProperty({ example: 0 })
  duplicateRows!: number;

  @ApiProperty({ type: [String], example: ['Їжа', 'Транспорт'] })
  topLevelCategoriesToCreateList!: string[];

  @ApiProperty({ type: [String], example: ['Кафе', 'Таксі'] })
  childCategoriesToCreateList!: string[];

  @ApiProperty({ type: [NearDuplicateClusterDto] })
  nearDuplicateClusterList!: NearDuplicateClusterDto[];
}
