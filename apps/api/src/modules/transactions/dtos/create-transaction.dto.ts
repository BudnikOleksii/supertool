import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';

import type { TransactionType } from '../../../database/schemas/enums';

import { TRANSACTION_TYPE_LIST, transactionTypeEnum } from '../../../database/schemas/enums';
import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';
import {
  CALENDAR_DATE_PATTERN,
  POSITIVE_AMOUNT_PATTERN,
} from '../../../shared/constants/transaction-validation';

export class CreateTransactionDto {
  @ApiProperty({
    enum: transactionTypeEnum.enumValues,
    enumName: OPENAPI_ENUM_NAME.transactionType,
  })
  @IsIn(TRANSACTION_TYPE_LIST)
  type!: TransactionType;

  @ApiProperty({ type: 'string', example: '1234.56' })
  @IsString()
  @Matches(POSITIVE_AMOUNT_PATTERN)
  amount!: string;

  @ApiProperty({ enum: CURRENCY_CODE_LIST, enumName: OPENAPI_ENUM_NAME.currencyCode })
  @IsIn(CURRENCY_CODE_LIST)
  currency!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ example: '2025-02-03' })
  @Matches(CALENDAR_DATE_PATTERN)
  date!: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  note?: string;
}
