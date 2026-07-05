import { ApiProperty } from '@nestjs/swagger';

import { BulkDeleteFailureDto } from './bulk-delete-failure.dto';

export class BulkDeleteResponseDto {
  @ApiProperty({ example: 3 })
  deletedCount!: number;

  @ApiProperty({ type: [BulkDeleteFailureDto] })
  failedList!: BulkDeleteFailureDto[];
}
