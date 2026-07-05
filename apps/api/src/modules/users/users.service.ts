import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { composeFullName } from '@supertool/shared/utils/full-name';

import type { UpdateUserDto } from './dtos/update-user.dto';
import type { UserResponseDto } from './dtos/user-response.dto';
import type { UserUpdatePatch } from './users.repository';

import { AnalyticsCacheService } from '../analytics/analytics-cache.service';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
    @Inject(AnalyticsCacheService) private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async getById(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByIdScoped(userId);

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const patch = await this.buildUpdatePatch(userId, dto);
    const user = await this.usersRepository.updateScoped(userId, patch);

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.usersRepository.deleteAccountScoped(userId);
    this.analyticsCache.invalidateUser(userId);
  }

  private async buildUpdatePatch(userId: string, dto: UpdateUserDto): Promise<UserUpdatePatch> {
    if (dto.firstName === undefined && dto.lastName === undefined) {
      return dto;
    }

    const current = await this.usersRepository.findByIdScoped(userId);

    if (!current) {
      throw new NotFoundException();
    }

    const effectiveFirstName = dto.firstName ?? current.firstName;
    const effectiveLastName = dto.lastName ?? current.lastName;

    return { ...dto, name: composeFullName(effectiveFirstName, effectiveLastName) };
  }
}
