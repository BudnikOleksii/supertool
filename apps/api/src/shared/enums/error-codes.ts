/**
 * Shared error codes carried in every error envelope (architecture D7).
 * Frontends resolve user-facing i18n messages by `code` — never by `message`.
 * One code per HTTP client-error status the API can emit; INTERNAL_ERROR
 * covers 5xx and anything unmapped.
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

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
