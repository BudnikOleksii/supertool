import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '@supertool/shared/constants/pagination';
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@supertool/shared/constants/transaction-sort';

import type { TransactionType } from '../../database/schemas/enums';
import type { CreateTransactionDto } from './dtos/create-transaction.dto';
import type { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import type { TransactionListResponseDto } from './dtos/transaction-list-response.dto';
import type { TransactionResponseDto } from './dtos/transaction-response.dto';
import type { UpdateTransactionDto } from './dtos/update-transaction.dto';

import { TransactionsRepository } from './transactions.repository';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(TransactionsRepository) private readonly transactionsRepository: TransactionsRepository,
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
      sortBy: query.sortBy ?? DEFAULT_SORT_BY,
      sortOrder: query.sortOrder ?? DEFAULT_SORT_ORDER,
      page,
      limit,
    });

    return { data, meta: { page, limit, total } };
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

    return this.transactionsRepository.create({
      userId,
      categoryId: dto.categoryId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      date: dto.date,
      note: dto.note ?? '',
    });
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

    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.transactionsRepository.deleteScoped(userId, id);

    if (!deleted) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Transaction not found' });
    }
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
