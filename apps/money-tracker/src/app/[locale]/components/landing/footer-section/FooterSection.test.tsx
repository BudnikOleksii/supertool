import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../../../../../constants/routes';
import { FooterSection } from './FooterSection';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CTA_NAMESPACE = 'homePage.content.cta';
const FOOTER_NAMESPACE = 'homePage.content.footer';

describe('FooterSection', () => {
  it('renders the closing CTA band with sign-up and sign-in actions', () => {
    render(<FooterSection />);

    const getStarted = screen.getByRole('link', { name: `${CTA_NAMESPACE}.getStarted` });
    const signIn = screen.getByRole('link', { name: `${CTA_NAMESPACE}.signIn` });

    expect(getStarted.getAttribute('href')).toBe(ROUTES.signUp);
    expect(signIn.getAttribute('href')).toBe(ROUTES.signIn);
  });

  it('renders the footer tagline and copyright', () => {
    render(<FooterSection />);

    expect(screen.getByText(`${FOOTER_NAMESPACE}.tagline`)).toBeTruthy();
    expect(screen.getByText(`${FOOTER_NAMESPACE}.copyright`)).toBeTruthy();
  });

  it('renders footer sign-in and sign-up links via ROUTES', () => {
    render(<FooterSection />);

    const signIn = screen.getByRole('link', { name: `${FOOTER_NAMESPACE}.signIn` });
    const signUp = screen.getByRole('link', { name: `${FOOTER_NAMESPACE}.signUp` });

    expect(signIn.getAttribute('href')).toBe(ROUTES.signIn);
    expect(signUp.getAttribute('href')).toBe(ROUTES.signUp);
  });
});
