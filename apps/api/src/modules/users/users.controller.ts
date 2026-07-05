import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import type { auth } from '../../auth/auth';

import { ErrorResponseDto } from '../../shared/dtos/error-response.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@Session() session: UserSession<typeof auth>): Promise<UserResponseDto> {
    return this.usersService.getById(session.user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async updateMe(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(session.user.id, dto);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(HTTP_STATUS_CODE.NoContent)
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async deleteMe(@Session() session: UserSession<typeof auth>): Promise<void> {
    await this.usersService.deleteAccount(session.user.id);
  }
}
