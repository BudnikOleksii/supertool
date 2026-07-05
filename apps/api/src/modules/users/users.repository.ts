import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { Database } from '../../database/database.types';
import type { UpdateUserDto } from './dtos/update-user.dto';
import type { UserResponseDto } from './dtos/user-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { users } from '../../database/schemas/users';

export interface UserUpdatePatch extends UpdateUserDto {
  name?: string;
}

const USER_RESPONSE_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  firstName: users.firstName,
  lastName: users.lastName,
  role: users.role,
  locale: users.locale,
  defaultCurrency: users.defaultCurrency,
  onboardingCompleted: users.onboardingCompleted,
};

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByIdScoped(userId: string): Promise<UserResponseDto | undefined> {
    const [user] = await this.db
      .select(USER_RESPONSE_COLUMNS)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }

  async updateScoped(userId: string, patch: UserUpdatePatch): Promise<UserResponseDto | undefined> {
    const [user] = await this.db
      .update(users)
      .set(buildUserUpdateValues(patch))
      .where(eq(users.id, userId))
      .returning(USER_RESPONSE_COLUMNS);

    return user;
  }
}

const buildUserUpdateValues = (patch: UserUpdatePatch): Partial<typeof users.$inferInsert> => ({
  updatedAt: new Date(),
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.firstName !== undefined && { firstName: patch.firstName }),
  ...(patch.lastName !== undefined && { lastName: patch.lastName }),
  ...(patch.locale !== undefined && { locale: patch.locale }),
  ...(patch.defaultCurrency !== undefined && { defaultCurrency: patch.defaultCurrency }),
  ...(patch.onboardingCompleted !== undefined && {
    onboardingCompleted: patch.onboardingCompleted,
  }),
});
