import { ApiProperty } from '@nestjs/swagger';

export class DefaultCategoriesResponseDto {
  @ApiProperty()
  topLevelCreated!: number;

  @ApiProperty()
  childrenCreated!: number;
}
