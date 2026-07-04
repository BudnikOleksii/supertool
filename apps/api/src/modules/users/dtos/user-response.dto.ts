import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';

import type { Role } from '../../../database/schemas/enums';

import { roleEnum } from '../../../database/schemas/enums';
import { OPENAPI_ENUM_NAME } from '../../../shared/constants/openapi-enum-name';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: roleEnum.enumValues, enumName: OPENAPI_ENUM_NAME.role })
  role!: Role;

  @ApiProperty({ enum: LOCALE_CODE_LIST, enumName: OPENAPI_ENUM_NAME.localeCode })
  locale!: string;

  @ApiPropertyOptional({
    enum: CURRENCY_CODE_LIST,
    enumName: OPENAPI_ENUM_NAME.currencyCode,
    nullable: true,
  })
  defaultCurrency!: string | null;

  @ApiProperty()
  onboardingCompleted!: boolean;
}
