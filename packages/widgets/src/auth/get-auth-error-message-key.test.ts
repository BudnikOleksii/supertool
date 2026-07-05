import { describe, expect, it } from 'vitest';

import { getAuthErrorMessageKey } from './get-auth-error-message-key';

const HTTP_TOO_MANY_REQUESTS = 429;

describe('getAuthErrorMessageKey', () => {
  it('maps invalid credentials to the invalidCredentials key', () => {
    expect(getAuthErrorMessageKey({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'invalidCredentials',
    );
  });

  it('maps an existing user to the userExists key', () => {
    expect(getAuthErrorMessageKey({ code: 'USER_ALREADY_EXISTS' })).toBe('userExists');
  });

  it('maps a wrong current password to the invalidCurrentPassword key', () => {
    expect(getAuthErrorMessageKey({ code: 'INVALID_PASSWORD' })).toBe('invalidCurrentPassword');
  });

  it('maps a too-short new password to the shared passwordMinLength key', () => {
    expect(getAuthErrorMessageKey({ code: 'PASSWORD_TOO_SHORT' })).toBe('passwordMinLength');
  });

  it('maps a rate-limit status to the rateLimited key', () => {
    expect(getAuthErrorMessageKey({ status: HTTP_TOO_MANY_REQUESTS })).toBe('rateLimited');
  });

  it('falls back to the generic key for unknown codes', () => {
    expect(getAuthErrorMessageKey({ code: 'SOME_UNKNOWN_CODE' })).toBe('generic');
  });
});
