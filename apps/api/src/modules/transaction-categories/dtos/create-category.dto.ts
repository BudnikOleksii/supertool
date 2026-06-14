import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '@supertool/shared/constants/validation';

import type { TransactionType } from '../../../database/schemas/enums';

import { TRANSACTION_TYPE_LIST, transactionTypeEnum } from '../../../database/schemas/enums';
import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @ApiProperty()
  @Transform(trimValue)
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({
    enum: transactionTypeEnum.enumValues,
    enumName: OPENAPI_ENUM_NAME.transactionType,
  })
  @IsIn(TRANSACTION_TYPE_LIST)
  type!: TransactionType;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  parentId?: string;
}
