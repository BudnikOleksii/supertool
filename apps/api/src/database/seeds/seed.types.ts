import { z } from 'zod';

import type { TransactionType } from '../schemas/enums';

export const seedSourceRecordSchema = z.object({
  Date: z.string(),
  Category: z.string(),
  Type: z.string(),
  Amount: z.number(),
  Currency: z.string(),
  Subcategory: z.string().optional(),
});

export type SeedSourceRecord = z.infer<typeof seedSourceRecordSchema>;

export interface TopLevelCategory {
  name: string;
  type: TransactionType;
}

export interface ChildCategory {
  name: string;
  type: TransactionType;
  parentName: string;
}

export interface CategoryHierarchy {
  topLevelList: TopLevelCategory[];
  childList: ChildCategory[];
}

export interface NearDuplicateCluster {
  normalizedKey: string;
  rawNameList: string[];
  hasMixedScript: boolean;
}

export interface SeedReport {
  inserted: number;
  skippedDuplicates: number;
  topLevelCreated: number;
  childrenCreated: number;
  nearDuplicateClusterList: NearDuplicateCluster[];
}
