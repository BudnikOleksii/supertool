import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReviewsSection } from './ReviewsSection';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const NAMESPACE = 'homePage.content.reviews';

const REVIEW_KEY_LIST = ['review1', 'review2', 'review3'] as const;

describe('ReviewsSection', () => {
  it('renders the section heading', () => {
    render(<ReviewsSection />);

    expect(screen.getByRole('heading', { name: `${NAMESPACE}.title` })).toBeTruthy();
  });

  it('renders every review with its quote, name and role', () => {
    render(<ReviewsSection />);

    REVIEW_KEY_LIST.forEach((key) => {
      expect(screen.getByText(new RegExp(`${key}\\.quote`))).toBeTruthy();
      expect(screen.getByText(`${NAMESPACE}.items.${key}.name`)).toBeTruthy();
      expect(screen.getByText(`${NAMESPACE}.items.${key}.role`)).toBeTruthy();
    });
  });
});
