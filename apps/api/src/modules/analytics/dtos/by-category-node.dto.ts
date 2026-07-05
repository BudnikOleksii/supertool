import { ApiProperty } from '@nestjs/swagger';

import type { TransactionType } from '../../../database/schemas/enums';

import { transactionTypeEnum } from '../../../database/schemas/enums';
import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';

export class ByCategoryNodeDto {
  @ApiProperty({ example: '0192f1a0-1c2d-7e3f-8a4b-5c6d7e8f9a0b' })
  categoryId!: string;

  @ApiProperty({ example: 'Groceries' })
  categoryName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  parentId!: string | null;

  @ApiProperty({
    enum: transactionTypeEnum.enumValues,
    enumName: OPENAPI_ENUM_NAME.transactionType,
  })
  type!: TransactionType;

  @ApiProperty({ type: 'string', example: '450.25' })
  total!: string;

  @ApiProperty({ type: 'number', example: 12 })
  transactionCount!: number;
}
