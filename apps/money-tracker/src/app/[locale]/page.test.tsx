import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { UserResponseDto } from '@supertool/shared/generated/types.gen';

import { fetchProfile } from '../../actions/fetch-profile';
import { ROUTES } from '../../constants/routes';
import HomePage from './page';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => key,
}));

vi.mock('../../actions/fetch-profile', () => ({
  fetchProfile: vi.fn(),
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('./components/landing/landing-page/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page" />,
}));

const fetchProfileMock = vi.mocked(fetchProfile);
const redirectMock = vi.mocked(redirect);

const LOCALE = 'en';
const PROPS = { params: Promise.resolve({ locale: LOCALE }) };

const MOCK_PROFILE = { id: 'user-1', onboardingCompleted: true } as unknown as UserResponseDto;

const renderHomePage = HomePage;

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects authenticated visitors to the dashboard', async () => {
    fetchProfileMock.mockResolvedValue(MOCK_PROFILE);

    await renderHomePage(PROPS);

    expect(redirectMock).toHaveBeenCalledWith({ href: ROUTES.dashboard, locale: LOCALE });
  });

  it('renders the landing page for unauthenticated visitors', async () => {
    fetchProfileMock.mockResolvedValue(null);

    render(await renderHomePage(PROPS));

    expect(screen.getByTestId('landing-page')).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
