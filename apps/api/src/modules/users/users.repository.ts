import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { Database } from '../../database/database.types';
import type { UserResponseDto } from './dtos/user-response.dto';

import { DRIZZLE } from '../../database/database.constants';
import { users } from '../../database/schemas/users';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByIdScoped(userId: string): Promise<UserResponseDto | undefined> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }
}
