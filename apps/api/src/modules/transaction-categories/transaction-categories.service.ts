import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ErrorCode } from '@supertool/shared/constants/error-codes';

import type { DatabaseExecutor } from '../../database/database.types';
import type { TransactionType } from '../../database/schemas/enums';
import type { CategoryResponseDto } from './dtos/category-response.dto';
import type { CreateCategoryDto } from './dtos/create-category.dto';
import type { DeleteCategoryDto } from './dtos/delete-category.dto';
import type { UpdateCategoryDto } from './dtos/update-category.dto';

import { TransactionCategoriesRepository } from './transaction-categories.repository';

interface NewParentParams {
  parentId: string;
  id: string;
  type: TransactionType;
  userId: string;
}

interface DuplicateParams {
  userId: string;
  name: string;
  type: TransactionType;
  parentId: string | null;
  excludeId?: string;
}

interface TransactionTargetParams {
  dto: DeleteCategoryDto;
  id: string;
  userId: string;
  type: TransactionType;
}

interface ChildrenTargetParams {
  dto: DeleteCategoryDto;
  id: string;
  userId: string;
  type: TransactionType;
}

@Injectable()
export class TransactionCategoriesService {
  constructor(
    @Inject(TransactionCategoriesRepository)
    private readonly repository: TransactionCategoriesRepository,
  ) {}

  async findAll(userId: string): Promise<CategoryResponseDto[]> {
    return this.repository.findAllByUserId(userId);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const parentId = dto.parentId ?? null;

    return this.repository.runInTransaction(async (tx) => {
      if (parentId !== null) {
        const parent = await this.loadParentOrThrow(parentId, userId, tx);
        this.assertSameType(parent.type, dto.type);
      }

      await this.assertNotDuplicate({ userId, name: dto.name, type: dto.type, parentId }, tx);

      return this.repository.create({ userId, name: dto.name, type: dto.type, parentId }, tx);
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.name === undefined && dto.parentId === undefined) {
      throw new BadRequestException({
        code: ErrorCode.ValidationError,
        message: 'At least one field must be provided',
      });
    }

    return this.repository.runInTransaction(async (tx) => {
      const existing = await this.loadScopedOrThrow(id, userId, tx);
      const resolvedParentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;

      if (dto.parentId !== undefined && dto.parentId !== null) {
        await this.assertValidNewParent(
          { parentId: dto.parentId, id, type: existing.type, userId },
          tx,
        );
      }

      await this.assertNotDuplicate(
        {
          userId,
          name: dto.name ?? existing.name,
          type: existing.type,
          parentId: resolvedParentId,
          excludeId: id,
        },
        tx,
      );

      const updated = await this.repository.update({ id, userId, data: dto }, tx);

      if (!updated) {
        throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Category not found' });
      }

      return updated;
    });
  }

  async delete(userId: string, id: string, dto: DeleteCategoryDto): Promise<void> {
    await this.repository.runInTransaction(async (tx) => {
      const category = await this.loadScopedOrThrow(id, userId, tx);
      const hasTransactions = await this.repository.hasTransactions(id, userId, tx);
      const hasChildren = await this.repository.hasChildren(id, userId, tx);

      if (hasTransactions) {
        const toCategoryId = await this.resolveTransactionTarget(
          { dto, id, userId, type: category.type },
          tx,
        );
        await this.repository.reassignTransactions(
          { fromCategoryId: id, toCategoryId, userId },
          tx,
        );
      }

      if (hasChildren) {
        const toParentId = await this.resolveChildrenTarget(
          { dto, id, userId, type: category.type },
          tx,
        );
        await this.repository.reassignChildren({ fromParentId: id, toParentId, userId }, tx);
      }

      await this.repository.deleteScoped(id, userId, tx);
    });
  }

  private async loadScopedOrThrow(
    id: string,
    userId: string,
    tx: DatabaseExecutor,
  ): Promise<CategoryResponseDto> {
    const category = await this.repository.findByIdScoped(id, userId, tx);

    if (!category) {
      throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Category not found' });
    }

    return category;
  }

  private async loadParentOrThrow(
    parentId: string,
    userId: string,
    tx: DatabaseExecutor,
  ): Promise<CategoryResponseDto> {
    const parent = await this.repository.findByIdScoped(parentId, userId, tx);

    if (!parent) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Parent category not found',
      });
    }

    return parent;
  }

  private assertSameType(parentType: TransactionType, childType: TransactionType): void {
    if (parentType !== childType) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'Parent category type must match the category type',
      });
    }
  }

  private async assertValidNewParent(params: NewParentParams, tx: DatabaseExecutor): Promise<void> {
    const parent = await this.loadParentOrThrow(params.parentId, params.userId, tx);
    this.assertSameType(parent.type, params.type);

    if (params.parentId === params.id) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: 'A category cannot be its own parent',
      });
    }

    const wouldCycle = await this.repository.isDescendantOf(
      { categoryId: params.parentId, potentialAncestorId: params.id, userId: params.userId },
      tx,
    );

    if (wouldCycle) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: 'Cannot move a category under itself or one of its descendants',
      });
    }
  }

  private async assertNotDuplicate(params: DuplicateParams, tx: DatabaseExecutor): Promise<void> {
    const exists = await this.repository.existsByNameTypeAndParent(params, tx);

    if (exists) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: 'A category with this name, type, and parent already exists',
      });
    }
  }

  private async resolveTransactionTarget(
    params: TransactionTargetParams,
    tx: DatabaseExecutor,
  ): Promise<string> {
    const targetId = params.dto.reassignTransactionsToCategoryId;

    if (targetId === undefined) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message:
          'reassignTransactionsToCategoryId is required to delete a category with transactions',
      });
    }

    if (targetId === params.id) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'Cannot reassign transactions to the category being deleted',
      });
    }

    const target = await this.loadScopedOrThrow(targetId, params.userId, tx);
    this.assertSameType(target.type, params.type);

    return targetId;
  }

  private async resolveChildrenTarget(
    params: ChildrenTargetParams,
    tx: DatabaseExecutor,
  ): Promise<string | null> {
    const targetId = this.requireChildrenTargetField(params.dto);

    if (targetId === null) {
      return null;
    }

    await this.assertValidChildTarget(targetId, params, tx);

    return targetId;
  }

  private requireChildrenTargetField(dto: DeleteCategoryDto): string | null {
    if (dto.reassignChildrenToParentId === undefined) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'reassignChildrenToParentId is required to delete a category with children',
      });
    }

    return dto.reassignChildrenToParentId;
  }

  private async assertValidChildTarget(
    targetId: string,
    params: ChildrenTargetParams,
    tx: DatabaseExecutor,
  ): Promise<void> {
    if (targetId === params.id) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'Cannot reassign children to the category being deleted',
      });
    }

    const target = await this.loadScopedOrThrow(targetId, params.userId, tx);
    this.assertSameType(target.type, params.type);
    await this.assertChildTargetNotDescendant(targetId, params, tx);
  }

  private async assertChildTargetNotDescendant(
    targetId: string,
    params: ChildrenTargetParams,
    tx: DatabaseExecutor,
  ): Promise<void> {
    const wouldCycle = await this.repository.isDescendantOf(
      { categoryId: targetId, potentialAncestorId: params.id, userId: params.userId },
      tx,
    );

    if (wouldCycle) {
      throw new UnprocessableEntityException({
        code: ErrorCode.UnprocessableEntity,
        message: 'Cannot reassign children under a descendant of the deleted category',
      });
    }
  }
}
