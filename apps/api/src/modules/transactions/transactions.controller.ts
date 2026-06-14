import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import type { auth } from '../../auth/auth';

import { ErrorResponseDto } from '../../shared/dtos/error-response.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
// oxlint-disable-next-line typescript/consistent-type-imports -- runtime import: ValidationPipe needs the @Query paramtype metadata, which SWC erases from type-only imports
import { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import { TransactionListResponseDto } from './dtos/transaction-list-response.dto';
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
}
