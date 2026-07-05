import { IntersectionType } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../shared/dtos/pagination-query.dto';
import { TransactionFilterQueryDto } from './transaction-filter-query.dto';

export class FindTransactionsQueryDto extends IntersectionType(
  PaginationQueryDto,
  TransactionFilterQueryDto,
) {}
