/**
 * Shared error codes carried in every error envelope (architecture D7).
 * Frontends resolve user-facing i18n messages by `code` — never by `message`.
 * Grows per story as modules introduce new failure modes.
 */
export const ErrorCode = {
  InternalError: 'INTERNAL_ERROR',
  NotFound: 'NOT_FOUND',
  ValidationError: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
