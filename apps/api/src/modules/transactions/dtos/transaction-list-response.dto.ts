import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaDto } from '../../../shared/dtos/pagination-meta.dto';
import { TransactionResponseDto } from './transaction-response.dto';

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data!: TransactionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
