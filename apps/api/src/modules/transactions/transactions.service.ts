import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '@supertool/shared/constants/pagination';
import { TRANSACTION_EXPORT_FORMAT } from '@supertool/shared/constants/transaction-export';
import type { TransactionExportFormat } from '@supertool/shared/constants/transaction-export';
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@supertool/shared/constants/transaction-sort';

import type { TransactionType } from '../../database/schemas/enums';
import type { BulkDeleteResponseDto } from './dtos/bulk-delete-response.dto';
import type { CreateTransactionDto } from './dtos/create-transaction.dto';
import type { ExportTransactionsQueryDto } from './dtos/export-transactions-query.dto';
import type { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import type { TransactionListResponseDto } from './dtos/transaction-list-response.dto';
import type { TransactionResponseDto } from './dtos/transaction-response.dto';
import type { UpdateTransactionDto } from './dtos/update-transaction.dto';
import type { TransactionExportResult } from './export/transaction-export-result';

import { AnalyticsCacheService } from '../analytics/analytics-cache.service';
import { buildExportFilename } from './export/build-export-filename';
import { convertTransactionToExportRow } from './export/convert-transaction-to-export-row';
import { formatTransactionsAsCsv } from './export/format-transactions-as-csv';
import { formatTransactionsAsJson } from './export/format-transactions-as-json';
import { TransactionsRepository } from './transactions.repository';

interface ExportTransactionsInput {
  userId: string;
  format: TransactionExportFormat;
  filters: ExportTransactionsQueryDto;
}

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

const getExportContentType = (format: TransactionExportFormat): string =>
  format === TRANSACTION_EXPORT_FORMAT.csv ? CSV_CONTENT_TYPE : JSON_CONTENT_TYPE;

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(TransactionsRepository) private readonly transactionsRepository: TransactionsRepository,
    @Inject(AnalyticsCacheService) private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async findAll(
    userId: string,
    query: FindTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    const page = query.page ?? FIRST_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const { data, total } = await this.transactionsRepository.findAllByUserId(userId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      type: query.type,
      categoryId: query.categoryId,
      search: query.search,
      sortBy: query.sortBy ?? DEFAULT_SORT_BY,
      sortOrder: query.sortOrder ?? DEFAULT_SORT_ORDER,
      page,
      limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async exportTransactions(input: ExportTransactionsInput): Promise<TransactionExportResult> {
    const { filters } = input;

    const { rowList, isTruncated } = await this.transactionsRepository.findAllForExport(
      input.userId,
      {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        type: filters.type,
        categoryId: filters.categoryId,
        sortBy: filters.sortBy ?? DEFAULT_SORT_BY,
        sortOrder: filters.sortOrder ?? DEFAULT_SORT_ORDER,
      },
    );

    const exportRowList = rowList.map(convertTransactionToExportRow);
    const content =
      input.format === TRANSACTION_EXPORT_FORMAT.csv
        ? formatTransactionsAsCsv(exportRowList)
        : formatTransactionsAsJson(exportRowList);

    return {
      content,
      contentType: getExportContentType(input.format),
      filename: buildExportFilename(input.format, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
      isTruncated,
    };
  }

  async findOne(userId: string, id: string): Promise<TransactionResponseDto> {
    const transaction = await this.transactionsRepository.findOneByUserIdAndId(userId, id);

    if (!transaction) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Transaction not found' });
    }

    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    await this.assertCategoryMatchesType(userId, dto.categoryId, dto.type);

    const created = await this.transactionsRepository.create({
      userId,
      categoryId: dto.categoryId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      date: dto.date,
      note: dto.note ?? '',
    });

    this.analyticsCache.invalidateUser(userId);

    return created;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    await this.assertCategoryMatchesType(userId, dto.categoryId, dto.type);

    const updated = await this.transactionsRepository.updateScoped(userId, id, {
      categoryId: dto.categoryId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      date: dto.date,
      note: dto.note ?? '',
    });

    if (!updated) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Transaction not found' });
    }

    this.analyticsCache.invalidateUser(userId);

    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.transactionsRepository.deleteScoped(userId, id);

    if (!deleted) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Transaction not found' });
    }

    this.analyticsCache.invalidateUser(userId);
  }

  async bulkDelete(userId: string, idList: string[]): Promise<BulkDeleteResponseDto> {
    const deletedIdList = await this.transactionsRepository.deleteManyScoped(userId, idList);
    const deletedIdSet = new Set(deletedIdList);

    this.analyticsCache.invalidateUser(userId);

    const failedList = idList
      .filter((id) => !deletedIdSet.has(id))
      .map((id) => ({ id, reason: ErrorCode.NotFound }));

    return { deletedCount: deletedIdList.length, failedList };
  }

  private async assertCategoryMatchesType(
    userId: string,
    categoryId: string,
    type: TransactionType,
  ): Promise<void> {
    const category = await this.transactionsRepository.findCategoryForUser(userId, categoryId);

    if (!category) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Category not found' });
    }

    if (category.type !== type) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'Category type does not match transaction type',
      });
    }
  }
}
