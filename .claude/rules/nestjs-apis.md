---
paths:
  - '**/*.ts'
  - '**/*.js'
---

You are a senior TypeScript programmer with experience in the NestJS framework with expertise in Drizzle ORM, clean code principles, and modern backend development.
Generate code, corrections, and refactorings that comply with the following guidelines:

## TypeScript General Guidelines

### Basic Principles

- Always declare explicit types for variables and functions.
  - Avoid using "any".
  - Create precise, descriptive types.
- Maintain a single export per file.
- Always use named exports. Never use default exports.

### Nomenclature

- Use PascalCase for classes.
- Use camelCase for variables, functions, and methods.
- Use kebab-case for directory names.
- Named constants must be in `UPPER_SNAKE_CASE`
- Use UPPERCASE for environment variables.
  - Avoid magic numbers and define constants.
- Start each function with a verb.
- Use verbs for boolean variables. Example: isLoading, hasError, canDelete, etc.
- Use complete words instead of abbreviations and correct spelling.
  - Except for standard abbreviations like API, URL, etc.
  - Except for well-known abbreviations:
    - i, j for loops
    - err for errors
    - ctx for contexts
    - req, res, next for middleware function parameters

### Functions

- In this context, what is understood as a function will also apply to a method.
- Write short functions with a single purpose. Less than 20 instructions.
- Name functions with a verb and something else.
  - If it returns a boolean, use isX or hasX, canX, etc.
  - If it doesn't return anything, use executeX or saveX, etc.
- Avoid nesting blocks by:
  - Early checks and returns.
  - Extraction to utility functions.
- Use higher-order functions (map, filter, reduce, etc.) to avoid function nesting.
  - Use arrow functions for simple functions (less than 3 instructions).
  - Use named functions for non-simple functions.
- Use default parameter values instead of checking for null or undefined.
- Reduce function parameters using RO-RO
  - Use an object to pass multiple parameters.
  - Use an object to return results.
  - Declare necessary types for input arguments and output.
- Use a single level of abstraction.

### Data

- Don't abuse primitive types and encapsulate data in composite types.
- Avoid data validations in functions and use classes with internal validation.
- Prefer immutability for data.
  - Use readonly for data that doesn't change.
  - Use as const for literals that don't change.

### Classes

- Follow SOLID principles.
- Prefer composition over inheritance.
- Declare interfaces to define contracts.
- Write small classes with a single purpose.
  - Less than 200 instructions.
  - Less than 10 public methods.
  - Less than 10 properties.

### Exceptions

- Use exceptions to handle errors you don't expect.
- If you catch an exception, it should be to:
  - Fix an expected problem.
  - Add context.
  - Otherwise, use a global handler.

### Testing

- Follow the Arrange-Act-Assert convention for tests.
- Name test variables clearly.
  - Follow the convention: inputX, mockX, actualX, expectedX, etc.
- Write unit tests for each public function.
  - Use test doubles to simulate dependencies.
    - Except for third-party dependencies that are not expensive to execute.
- Write acceptance tests for each module.
  - Follow the Given-When-Then convention.

## Specific to NestJS

### Basic Principles

- Use modular architecture
- Encapsulate the API in modules.
  - One module per main domain/route.
  - One controller for its route.
    - And other controllers for secondary routes.
  - A models folder with data types.
    - DTOs validated with class-validator for inputs.
    - Declare simple types for outputs.
  - A services module with business logic and persistence.
    - One service per entity.
  - A repository layer to separate interaction with the database.
    - Use dedicated repository classes that fetch data via Drizzle — repositories are the only DB-touching layer.
- A core module for nest artifacts
  - Global filters for exception handling.
  - Global middlewares for request management.
  - Guards for permission management.
  - Interceptors for request management.
- A shared module for services shared between modules.
  - Utilities
  - Shared business logic

### DTOs & the generated OpenAPI client

- The frontend consumes the API only through the generated client (`packages/shared/src/generated/`), which mirrors `apps/api/openapi.json` 1:1 and never imports app code. Whatever the Swagger decorators emit IS the client's type — design DTOs for the generated output, not just for runtime validation.
- Enum/union fields MUST set `enumName` on `@ApiProperty`/`@ApiPropertyOptional`. Without it the generator (`@hey-api/openapi-ts`) inlines the literal union at every occurrence — no reusable named type, and the request and response copies silently drift. With `enumName` it emits one named type (e.g. `LocaleCode`) shared by every DTO that references it.
- Use the SAME `enumName` for the same concept on BOTH the request DTO (e.g. `UpdateUserDto.locale`) and the response DTO (e.g. `UserResponseDto.locale`) so reads and writes share one generated type. A field typed as an enum on input but bare `string` on output is a defect.
- `enumName` values come from the `OPENAPI_ENUM_NAME` const map (`src/shared/constants/openapi-enum-name.ts`) — never hardcode the string literal at the decorator. Add an entry there when introducing a new named schema.
- Enum VALUES stay single-sourced from the shared value list (`LOCALE_CODE_LIST`, `CURRENCY_CODE_LIST`) or a `pgEnum`'s `enumValues`: pass that list to `@IsIn(...)` for validation and to `enum:` for the schema. The `classValidatorShim` (nest-cli.json) lifts `@IsIn` into the spec, but `enumName` must still be set explicitly to get a named type.
- Regenerate after changing any DTO or shared value list: `pnpm --filter @supertool/api build` (emits `openapi.json`), then `pnpm --filter @supertool/shared generate:client`. The generated `LocaleCode`/`CurrencyCode` are hey-api-owned types — named identically to the `@supertool/shared` constants' types but distinct (structurally compatible) declarations; at call sites prefer importing them from the generated module.

### Dependency Injection

- Every constructor injection uses an explicit `@Inject(ClassNameOrToken)` decorator — never rely on `emitDecoratorMetadata` alone.
- Never use `import type` for an injectable (service, repository, Logger): tsc resurrects type-only imports referenced in decorator metadata, but SWC under Vitest erases them and emits `Object` paramtypes — DI then fails in specs and Testcontainers integration tests. With explicit `@Inject`, the import is value-position usage, `typescript/consistent-type-imports` stays satisfied, and a regression to `import type` becomes a compile error.
- Non-class providers (drizzle instance, env) use `Symbol` tokens from a `*.constants.ts` file (`DRIZZLE`, `PG_POOL`, `ENV`); their TypeScript types may be `import type` since the token, not the type, drives resolution.

### Configuration & environment

- All environment variables flow through the single validated schema in `src/app/env.schema.ts` (zod `envSchema` + `parseEnv`, which `safeParse`s and throws a formatted error on failure). NEVER scatter hardcoded fallback literals (secrets, URLs, connection strings) in feature modules — add the var to `envSchema` and read it. Use a zod `.default()` ONLY for vars that are safe to default locally (`NODE_ENV`, `PORT`, `AUTH_RATE_LIMIT_DISABLED`); required secrets and connection strings (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_TRUSTED_ORIGINS`) have NO default and must be supplied at runtime. Module-level singletons constructed outside Nest DI (e.g. the better-auth instance in `src/auth/auth.ts`) call `parseEnv()` directly rather than redeclaring their own fallbacks.
- Every env var must be listed in `apps/api/.env.example` (local-dev values; the gitignored `.env` carries real ones).

## Architecture Principles

- Organize code by feature, not by file type
- Keep related files close together
- Use dependency injection for better testability
- Implement proper error handling
- Follow single responsibility principle

### Testing

- Use Vitest for testing (SWC decorators); Testcontainers for integration tests against real Postgres.
- Write tests for each controller and service.
- Write end to end tests for each api module.
