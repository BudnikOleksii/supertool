import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdvantagesSection } from './AdvantagesSection';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const NAMESPACE = 'homePage.content.advantages';

const ADVANTAGE_KEY_LIST = ['tracking', 'import', 'insights', 'categories'] as const;

describe('AdvantagesSection', () => {
  it('renders the section heading', () => {
    render(<AdvantagesSection />);

    expect(screen.getByRole('heading', { name: `${NAMESPACE}.title` })).toBeTruthy();
  });

  it('renders every advantage with its title and description', () => {
    render(<AdvantagesSection />);

    ADVANTAGE_KEY_LIST.forEach((key) => {
      expect(screen.getByText(`${NAMESPACE}.items.${key}.title`)).toBeTruthy();
      expect(screen.getByText(`${NAMESPACE}.items.${key}.description`)).toBeTruthy();
    });
  });

  it('renders advantage titles at heading level 3 to preserve hierarchy', () => {
    render(<AdvantagesSection />);

    const advantageHeadingList = screen.getAllByRole('heading', { level: 3 });

    expect(advantageHeadingList).toHaveLength(ADVANTAGE_KEY_LIST.length);
  });
});
