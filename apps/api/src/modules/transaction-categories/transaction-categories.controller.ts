import type { UserSession } from '@thallesp/nestjs-better-auth';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import type { auth } from '../../auth/auth';

import { ErrorResponseDto } from '../../shared/dtos/error-response.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { CategoryResponseDto } from './dtos/category-response.dto';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { DefaultCategoriesResponseDto } from './dtos/default-categories-response.dto';
import { DeleteCategoryDto } from './dtos/delete-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { TransactionCategoriesService } from './transaction-categories.service';

const HTTP_NO_CONTENT = 204;

@ApiTags('transactionCategories')
@Controller('transaction-categories')
@UseGuards(AuthGuard)
export class TransactionCategoriesController {
  constructor(
    @Inject(TransactionCategoriesService)
    private readonly service: TransactionCategoriesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async findAll(@Session() session: UserSession<typeof auth>): Promise<CategoryResponseDto[]> {
    return this.service.findAll(session.user.id);
  }

  @Post('defaults')
  @ApiCreatedResponse({ type: DefaultCategoriesResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async createDefaults(
    @Session() session: UserSession<typeof auth>,
  ): Promise<DefaultCategoriesResponseDto> {
    return this.service.createDefaults(session.user.id);
  }

  @Post()
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async create(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.service.create(session.user.id, dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async update(
    @Session() session: UserSession<typeof auth>,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.service.update(session.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HTTP_NO_CONTENT)
  @ApiBody({ type: DeleteCategoryDto })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async remove(
    @Session() session: UserSession<typeof auth>,
    @Param('id') id: string,
    @Body() dto: DeleteCategoryDto,
  ): Promise<void> {
    await this.service.delete(session.user.id, id, dto);
  }
}
