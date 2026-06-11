import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ErrorCode } from '../enums/error-codes';

export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ enum: Object.values(ErrorCode), enumName: 'ErrorCode' })
  code!: ErrorCode;

  @ApiProperty({ example: 'Resource not found' })
  message!: string;

  @ApiPropertyOptional({ type: Object })
  details?: Record<string, unknown>;
}
