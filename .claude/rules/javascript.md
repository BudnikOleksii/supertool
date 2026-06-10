---
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.jsx'
---

# JavaScript/TypeScript Conventions

## General

- Never re-export variables, types, functions. Do not create barrel files.

## Variables

- Use named exports where possible
- Array variables MUST include `list` suffix (not plural form). Example `userList`
- Named constants must be in `UPPER_SNAKE_CASE`
- Place constants at top of file or in `constants.ts` for component-specific constants
- Shared constants go in `packages/shared/src/constants` or common parent directory

## Functions

- Use arrow functions
- Use these prefixes consistently:

| Prefix      | Use Case                                 | Example                                |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `get`       | Retrieve data from objects, calculations | `getConfig`, `getCorrelationId`        |
| `fetch`     | External API calls, async data retrieval | `fetchFileAsBlob`, `fetchDocumentList` |
| `check`     | Boolean returns, validation, typeguards  | `checkIsObject`, `checkIsValid`        |
| `format`    | Transform data appearance                | `formatCardNumber`, `formatDate`       |
| `convert`   | Type/structure conversion                | `convertDateToTimestamp`               |
| `prepare`   | Assemble data structures                 | `prepareProductJsonLd`                 |
| `parse`     | Extract structured data from raw input   | `parseDashboardSearchParams`           |
| `normalize` | Coerce values to a consistent type       | `normalizeParam`                       |
