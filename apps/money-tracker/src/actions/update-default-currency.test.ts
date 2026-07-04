import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateDefaultCurrency } from './update-default-currency';

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

describe('updateDefaultCurrency', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an out-of-list currency without calling the API', async () => {
    const actual = await updateDefaultCurrency('XXX');

    expect(actual).toEqual({ status: 'error', code: 'VALIDATION_ERROR' });
    expect(usersUpdateMe).not.toHaveBeenCalled();
  });

  it('persists the currency and revalidates the layout on success', async () => {
    usersUpdateMe.mockResolvedValue({ data: { id: 'user-1' }, error: undefined });

    const actual = await updateDefaultCurrency('UAH');

    expect(usersUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ body: { defaultCurrency: 'UAH' } }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(actual).toEqual({ status: 'success' });
  });

  it('passes an API error through as an error ActionState', async () => {
    usersUpdateMe.mockResolvedValue({
      data: undefined,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    });

    const actual = await updateDefaultCurrency('UAH');

    expect(actual).toEqual({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Session expired',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
