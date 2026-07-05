import type { BulkDeleteFailureDto } from '@supertool/shared/generated/types.gen';

export type BulkDeleteView = { kind: 'byDate' } | { kind: 'byCategory'; categoryId: string };

export type BulkDeleteFailureItem = BulkDeleteFailureDto;
