import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveOnboardedProfile } from './resolve-onboarded-profile';

const REDIRECT_SIGNAL = 'REDIRECT';

const { fetchProfile, redirect } = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));

vi.mock('../actions/fetch-profile', () => ({ fetchProfile }));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({ redirect }));

const LOCALE = 'en';

const buildProfile = (onboardingCompleted: boolean) => ({
  id: 'user-id',
  email: 'a@b.com',
  name: 'Ann',
  role: 'user',
  locale: 'en',
  defaultCurrency: 'UAH',
  onboardingCompleted,
});

describe('resolveOnboardedProfile', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects an unauthenticated visitor to sign-in', async () => {
    fetchProfile.mockResolvedValue(null);

    await expect(resolveOnboardedProfile(LOCALE)).rejects.toThrow(REDIRECT_SIGNAL);
    expect(redirect).toHaveBeenCalledWith({ href: '/sign-in', locale: LOCALE });
  });

  it('redirects a non-onboarded profile to onboarding', async () => {
    fetchProfile.mockResolvedValue(buildProfile(false));

    await expect(resolveOnboardedProfile(LOCALE)).rejects.toThrow(REDIRECT_SIGNAL);
    expect(redirect).toHaveBeenCalledWith({ href: '/onboarding', locale: LOCALE });
  });

  it('returns the profile for an onboarded user without redirecting', async () => {
    const expectedProfile = buildProfile(true);
    fetchProfile.mockResolvedValue(expectedProfile);

    const actual = await resolveOnboardedProfile(LOCALE);

    expect(actual).toEqual(expectedProfile);
    expect(redirect).not.toHaveBeenCalled();
  });
});
