import { ApiProperty } from '@nestjs/swagger';

export class NearDuplicateClusterDto {
  @ApiProperty({ example: 'їжа' })
  normalizedKey!: string;

  @ApiProperty({ type: [String], example: ['Їжа', 'Їжa'] })
  rawNameList!: string[];

  @ApiProperty({ example: true })
  hasMixedScript!: boolean;
}
