import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { UserResponseDto } from './dtos/user-response.dto';

import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(@Inject(UsersRepository) private readonly usersRepository: UsersRepository) {}

  async getById(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }
}
