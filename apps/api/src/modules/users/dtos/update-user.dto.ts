import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 100;

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ enum: LOCALE_CODE_LIST })
  @IsOptional()
  @IsIn(LOCALE_CODE_LIST)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(CURRENCY_CODE_LIST)
  defaultCurrency?: string;
}
