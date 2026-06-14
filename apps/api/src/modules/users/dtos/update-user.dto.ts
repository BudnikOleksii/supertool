import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '@supertool/shared/constants/validation';

import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ enum: LOCALE_CODE_LIST, enumName: OPENAPI_ENUM_NAME.localeCode })
  @IsOptional()
  @IsIn(LOCALE_CODE_LIST)
  locale?: string;

  @ApiPropertyOptional({ enum: CURRENCY_CODE_LIST, enumName: OPENAPI_ENUM_NAME.currencyCode })
  @IsOptional()
  @IsIn(CURRENCY_CODE_LIST)
  defaultCurrency?: string;
}
