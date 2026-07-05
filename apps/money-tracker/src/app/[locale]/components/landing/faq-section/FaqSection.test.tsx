import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FaqSection } from './FaqSection';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const NAMESPACE = 'homePage.content.faq';

describe('FaqSection', () => {
  it('renders every question as a collapsed trigger', () => {
    render(<FaqSection />);

    expect(screen.getByRole('button', { name: `${NAMESPACE}.items.q1.question` })).toBeTruthy();
    expect(screen.queryByText(`${NAMESPACE}.items.q1.answer`)).toBeNull();
  });

  it('reveals the answer when a question is expanded', () => {
    render(<FaqSection />);

    const trigger = screen.getByRole('button', { name: `${NAMESPACE}.items.q1.question` });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(`${NAMESPACE}.items.q1.answer`)).toBeTruthy();
  });
});
