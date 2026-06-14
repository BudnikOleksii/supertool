import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteCategoryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  reassignTransactionsToCategoryId?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  reassignChildrenToParentId?: string | null;
}
