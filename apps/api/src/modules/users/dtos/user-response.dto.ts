import { ApiProperty } from '@nestjs/swagger';

import type { Role } from '../../../database/schemas/enums';

import { roleEnum } from '../../../database/schemas/enums';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: roleEnum.enumValues, enumName: 'Role' })
  role!: Role;
}
