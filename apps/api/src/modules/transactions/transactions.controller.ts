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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import type { auth } from '../../auth/auth';

import { ErrorResponseDto } from '../../shared/dtos/error-response.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { CreateTransactionDto } from './dtos/create-transaction.dto';
// oxlint-disable-next-line typescript/consistent-type-imports -- runtime import: ValidationPipe needs the @Query paramtype metadata, which SWC erases from type-only imports
import { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import { TransactionListResponseDto } from './dtos/transaction-list-response.dto';
import { TransactionResponseDto } from './dtos/transaction-response.dto';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: TransactionListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: FindTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    return this.transactionsService.findAll(session.user.id, query);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBody({ type: CreateTransactionDto })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async create(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(session.user.id, dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findOne(
    @Session() session: UserSession<typeof auth>,
    @Param('id') id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.findOne(session.user.id, id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBody({ type: UpdateTransactionDto })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async update(
    @Session() session: UserSession<typeof auth>,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(session.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HTTP_STATUS_CODE.NoContent)
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(
    @Session() session: UserSession<typeof auth>,
    @Param('id') id: string,
  ): Promise<void> {
    await this.transactionsService.delete(session.user.id, id);
  }
}
