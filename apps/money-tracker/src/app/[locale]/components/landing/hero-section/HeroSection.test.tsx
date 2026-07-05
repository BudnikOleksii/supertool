import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../../../../../constants/routes';
import { HeroSection } from './HeroSection';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const NAMESPACE = 'homePage.content.hero';

describe('HeroSection', () => {
  it('renders a single h1 headline', () => {
    render(<HeroSection />);

    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading.textContent).toBe(`${NAMESPACE}.title`);
  });

  it('links the primary CTA to sign up and the secondary CTA to sign in', () => {
    render(<HeroSection />);

    const getStarted = screen.getByRole('link', { name: `${NAMESPACE}.getStarted` });
    const signIn = screen.getByRole('link', { name: `${NAMESPACE}.signIn` });

    expect(getStarted.getAttribute('href')).toBe(ROUTES.signUp);
    expect(signIn.getAttribute('href')).toBe(ROUTES.signIn);
  });

  it('exposes a learn-more anchor to the features section', () => {
    render(<HeroSection />);

    const learnMore = screen.getByRole('link', { name: `${NAMESPACE}.learnMore` });

    expect(learnMore.getAttribute('href')).toBe('#features');
  });
});
