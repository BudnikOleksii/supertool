import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteAccount } from './delete-account';

const { usersDeleteMe, redirect, getLocale, cookieStore } = vi.hoisted(() => ({
  usersDeleteMe: vi.fn(),
  redirect: vi.fn(),
  getLocale: vi.fn(),
  cookieStore: {
    toString: vi.fn(() => 'better-auth.session_token=abc'),
    getAll: vi.fn(() => [{ name: 'better-auth.session_token' }, { name: 'other' }]),
    delete: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock('next-intl/server', () => ({
  getLocale,
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  redirect,
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  UsersApiService: { usersDeleteMe },
}));

describe('deleteAccount', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the account, clears the better-auth cookie, and redirects to sign-in on success', async () => {
    usersDeleteMe.mockResolvedValue({ data: undefined, error: undefined });
    getLocale.mockResolvedValue('en');

    await deleteAccount();

    expect(usersDeleteMe).toHaveBeenCalledOnce();
    expect(cookieStore.delete).toHaveBeenCalledWith('better-auth.session_token');
    expect(cookieStore.delete).not.toHaveBeenCalledWith('other');
    expect(redirect).toHaveBeenCalledWith({ href: '/sign-in', locale: 'en' });
  });

  it('returns an error ActionState and does not redirect when the API fails', async () => {
    usersDeleteMe.mockResolvedValue({
      data: undefined,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    });

    const actual = await deleteAccount();

    expect(actual).toEqual({ status: 'error', code: 'UNAUTHORIZED', message: 'Session expired' });
    expect(redirect).not.toHaveBeenCalled();
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });
});
