import type { UserSession } from '@thallesp/nestjs-better-auth';

import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';
import { TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } from '@supertool/shared/constants/transaction-import';

import type { auth } from '../../auth/auth';

import { ErrorResponseDto } from '../../shared/dtos/error-response.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { CreateTransactionDto } from './dtos/create-transaction.dto';
// oxlint-disable-next-line typescript/consistent-type-imports -- runtime import: ValidationPipe needs the @Query paramtype metadata, which SWC erases from type-only imports
import { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import { TransactionImportPreviewResponseDto } from './dtos/transaction-import-preview-response.dto';
import { TransactionImportResponseDto } from './dtos/transaction-import-response.dto';
import { TransactionListResponseDto } from './dtos/transaction-list-response.dto';
import { TransactionResponseDto } from './dtos/transaction-response.dto';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';
import { TransactionsImportService } from './transactions-import.service';
import { TransactionsService } from './transactions.service';

const IMPORT_FILE_BODY_SCHEMA = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

const requireImportFile = (file: Express.Multer.File | undefined): Express.Multer.File => {
  if (!file) {
    throw new BadRequestException({
      code: ErrorCode.ValidationError,
      message: 'File is required. Upload a .json or .csv file',
    });
  }

  return file;
};

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
    @Inject(TransactionsImportService)
    private readonly transactionsImportService: TransactionsImportService,
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

  @Post('import')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMPORT_FILE_BODY_SCHEMA)
  @ApiCreatedResponse({ type: TransactionImportResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiPayloadTooLargeResponse({ type: ErrorResponseDto })
  async import(
    @Session() session: UserSession<typeof auth>,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<TransactionImportResponseDto> {
    return this.transactionsImportService.importTransactions(
      session.user.id,
      requireImportFile(file),
    );
  }

  @Post('import/preview')
  @UseGuards(AuthGuard)
  @HttpCode(HTTP_STATUS_CODE.Ok)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMPORT_FILE_BODY_SCHEMA)
  @ApiOkResponse({ type: TransactionImportPreviewResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiPayloadTooLargeResponse({ type: ErrorResponseDto })
  async importPreview(
    @Session() session: UserSession<typeof auth>,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<TransactionImportPreviewResponseDto> {
    return this.transactionsImportService.previewImport(session.user.id, requireImportFile(file));
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
