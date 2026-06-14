---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript rules

- Prefer interfaces over types
- Do not use enums — use objects with `as const` assertion and derive the value union via the `ObjectValuesUnion<T>` generic (`packages/shared/src/types/object-values-union.ts`). Example: `export type ErrorCode = ObjectValuesUnion<typeof ErrorCode>`.
- No type assertions (`as`) in production code — narrow with type guards (`checkIs*` predicates) instead; `as const` is the only sanctioned form. `as unknown as X` is acceptable solely for partial test doubles in specs.
- A value set must have ONE source of truth — never re-list its members. For DB-backed enums the Drizzle `pgEnum` (`schemas/enums.ts`) is that source: derive the TS union with `(typeof roleEnum.enumValues)[number]`, spread the values where a list is needed (`[...roleEnum.enumValues]`), and export a named default (e.g. `DEFAULT_ROLE`) instead of repeating the literal in schemas, DTOs, or auth config.
