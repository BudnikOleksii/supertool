import { Inject, Injectable } from '@nestjs/common';

import type { FindTransactionsQueryDto } from './dtos/find-transactions-query.dto';
import type { TransactionListResponseDto } from './dtos/transaction-list-response.dto';

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
}
