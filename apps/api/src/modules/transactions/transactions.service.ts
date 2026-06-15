import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ErrorCode } from '@supertool/shared/constants/error-codes';

import type { CreateTransactionDto } from './dtos/create-transaction.dto';
import type { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import type { TransactionListResponseDto } from './dtos/transaction-list-response.dto';
import type { TransactionResponseDto } from './dtos/transaction-response.dto';

import { DEFAULT_PAGE_SIZE, FIRST_PAGE } from '../../shared/constants/pagination';
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
      page,
      limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    const category = await this.transactionsRepository.findCategoryForUser(userId, dto.categoryId);

    if (!category) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Category not found' });
    }

    if (category.type !== dto.type) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'Category type does not match transaction type',
      });
    }

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
}
