import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { Database } from '../../database/database.types';
import type { UpdateUserDto } from './dtos/update-user.dto';
import type { UserResponseDto } from './dtos/user-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { users } from '../../database/schemas/users';

const USER_RESPONSE_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
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

  async updateScoped(userId: string, patch: UpdateUserDto): Promise<UserResponseDto | undefined> {
    const [user] = await this.db
      .update(users)
      .set(buildUserUpdateValues(patch))
      .where(eq(users.id, userId))
      .returning(USER_RESPONSE_COLUMNS);

    return user;
  }
}

const buildUserUpdateValues = (patch: UpdateUserDto): Partial<typeof users.$inferInsert> => {
  const updateValues: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

  if (patch.name !== undefined) {
    updateValues.name = patch.name;
  }

  if (patch.locale !== undefined) {
    updateValues.locale = patch.locale;
  }

  if (patch.defaultCurrency !== undefined) {
    updateValues.defaultCurrency = patch.defaultCurrency;
  }

  if (patch.onboardingCompleted !== undefined) {
    updateValues.onboardingCompleted = patch.onboardingCompleted;
  }

  return updateValues;
};
