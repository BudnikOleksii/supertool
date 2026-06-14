import { ApiProperty } from '@nestjs/swagger';

import type { TransactionType } from '../../../database/schemas/enums';

import { transactionTypeEnum } from '../../../database/schemas/enums';
import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '2025-02-03' })
  date!: string;

  @ApiProperty({
    enum: transactionTypeEnum.enumValues,
    enumName: OPENAPI_ENUM_NAME.transactionType,
  })
  type!: TransactionType;

  @ApiProperty({ type: 'string', example: '1234.56' })
  amount!: string;

  @ApiProperty({ example: 'UAH' })
  currency!: string;

  @ApiProperty()
  note!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  categoryParentName!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
