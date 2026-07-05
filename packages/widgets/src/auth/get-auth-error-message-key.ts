const HTTP_TOO_MANY_REQUESTS = 429;

const AUTH_ERROR_KEY_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'invalidCredentials',
  USER_ALREADY_EXISTS: 'userExists',
  INVALID_PASSWORD: 'invalidCurrentPassword',
  PASSWORD_TOO_SHORT: 'passwordMinLength',
};

interface AuthClientError {
  code?: string | undefined;
  status?: number | undefined;
}

export const getAuthErrorMessageKey = (error: AuthClientError): string => {
  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return 'rateLimited';
  }

  const mappedKey = error.code === undefined ? undefined : AUTH_ERROR_KEY_BY_CODE[error.code];

  return mappedKey ?? 'generic';
};
