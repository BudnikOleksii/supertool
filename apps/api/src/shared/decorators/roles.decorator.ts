import { Reflector } from '@nestjs/core';

import type { Role } from '../../database/schemas/enums';

export const Roles = Reflector.createDecorator<Role[]>();
