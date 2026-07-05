import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateLocale } from './update-locale';

const { usersUpdateMe, revalidatePath } = vi.hoisted(() => ({
  usersUpdateMe: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => '' }),
}));

vi.mock('@supertool/next-shared/src/client/create-server-api-client', () => ({
  createServerApiClient: () => ({}),
}));

vi.mock('@supertool/shared/generated/sdk.gen', () => ({
  UsersApiService: { usersUpdateMe },
}));

describe('updateLocale', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a validation error without calling the API for an unsupported locale', async () => {
    const actual = await updateLocale('fr');

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(usersUpdateMe).not.toHaveBeenCalled();
  });

  it('sends only the locale and revalidates the layout on success', async () => {
    usersUpdateMe.mockResolvedValue({ data: { id: 'user-id' }, error: undefined });

    const actual = await updateLocale('uk');

    expect(actual).toEqual({ status: 'success' });
    expect(usersUpdateMe).toHaveBeenCalledWith(expect.objectContaining({ body: { locale: 'uk' } }));
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('maps an API error to an error ActionState and does not revalidate', async () => {
    usersUpdateMe.mockResolvedValue({
      data: undefined,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    });

    const actual = await updateLocale('uk');

    expect(actual).toEqual({ status: 'error', code: 'UNAUTHORIZED', message: 'Session expired' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
