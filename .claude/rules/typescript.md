---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript rules

- Prefer interfaces over types
- Do not use enums — use objects with `as const` assertion and derive the value union via the `ObjectValuesUnion<T>` generic (currently `apps/api/src/shared/types/object-values-union.ts`; moves to `packages/shared/src/types/` in Story 1.3). Example: `export type ErrorCode = ObjectValuesUnion<typeof ErrorCode>`.
- No type assertions (`as`) in production code — narrow with type guards (`checkIs*` predicates) instead; `as const` is the only sanctioned form. `as unknown as X` is acceptable solely for partial test doubles in specs.
