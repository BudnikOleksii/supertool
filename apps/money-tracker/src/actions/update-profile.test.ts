import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateProfile } from './update-profile';

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

const VALID_VALUES = {
  firstName: 'Ann',
  lastName: 'Smith',
  locale: 'en' as const,
  defaultCurrency: 'UAH' as const,
};

describe('updateProfile', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a validation error without calling the API when input is invalid', async () => {
    const actual = await updateProfile({ ...VALID_VALUES, firstName: '' });

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(usersUpdateMe).not.toHaveBeenCalled();
  });

  it('sends first and last name to the API and revalidates on success', async () => {
    usersUpdateMe.mockResolvedValue({ data: { id: 'user-id' }, error: undefined });

    const actual = await updateProfile(VALID_VALUES);

    expect(actual).toEqual({ status: 'success' });
    expect(usersUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { firstName: 'Ann', lastName: 'Smith', locale: 'en', defaultCurrency: 'UAH' },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/settings');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('omits the last name from the request body when it is not provided', async () => {
    usersUpdateMe.mockResolvedValue({ data: { id: 'user-id' }, error: undefined });

    await updateProfile({ firstName: 'Ann', locale: 'en' });

    expect(usersUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ body: { firstName: 'Ann', locale: 'en' } }),
    );
  });

  it('maps an API error to an error ActionState and does not revalidate', async () => {
    usersUpdateMe.mockResolvedValue({
      data: undefined,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    });

    const actual = await updateProfile(VALID_VALUES);

    expect(actual).toEqual({ status: 'error', code: 'UNAUTHORIZED', message: 'Session expired' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
