import { ApiProperty } from '@nestjs/swagger';

import { ErrorCode } from '@supertool/shared/constants/error-codes';

import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';

export class BulkDeleteFailureDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: Object.values(ErrorCode),
    enumName: OPENAPI_ENUM_NAME.errorCode,
  })
  reason!: ErrorCode;
}
