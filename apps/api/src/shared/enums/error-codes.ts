import type { ObjectValuesUnion } from '../types/object-values-union';

/**
 * Shared error codes carried in every error envelope (architecture D7).
 * `statusCode` is transport-level; `code` is the application-level
 * discriminator the frontend maps to i18n messages — never the raw `message`.
 * Domain codes (e.g. category-reassignment failures, FR12) join HTTP-derived
 * ones from Story 2.x on; the whole object moves to `packages/shared` in 1.3
 * so the frontend consumes the same source of truth.
 */
export const ErrorCode = {
  InternalError: 'INTERNAL_ERROR',
  NotFound: 'NOT_FOUND',
  ValidationError: 'VALIDATION_ERROR',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  Conflict: 'CONFLICT',
  UnprocessableEntity: 'UNPROCESSABLE_ENTITY',
  TooManyRequests: 'TOO_MANY_REQUESTS',
} as const;

export type ErrorCode = ObjectValuesUnion<typeof ErrorCode>;
