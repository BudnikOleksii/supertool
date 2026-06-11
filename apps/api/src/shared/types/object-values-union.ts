/*
 * Derives the value union from an `as const` object — the no-enum pattern
 * (.claude/rules/typescript.md). Moves to `packages/shared/src/types/` when
 * Story 1.3 creates the shared package, so all apps reuse one definition.
 */
export type ObjectValuesUnion<T> = T[keyof T];
