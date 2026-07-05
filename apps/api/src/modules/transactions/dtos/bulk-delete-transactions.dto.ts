import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

import {
  MAX_BULK_DELETE_IDS,
  MIN_BULK_DELETE_IDS,
} from '@supertool/shared/constants/transaction-bulk';

export class BulkDeleteTransactionsDto {
  @ApiProperty({
    type: [String],
    minItems: MIN_BULK_DELETE_IDS,
    maxItems: MAX_BULK_DELETE_IDS,
    example: ['0192f1a0-1c2d-7e3f-8a9b-0c1d2e3f4a5b'],
  })
  @IsArray()
  @ArrayMinSize(MIN_BULK_DELETE_IDS)
  @ArrayMaxSize(MAX_BULK_DELETE_IDS)
  @ArrayUnique()
  @IsString({ each: true })
  idList!: string[];
}
