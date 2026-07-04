import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StepIndicator } from './StepIndicator';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

const renderStepIndicator = StepIndicator;

describe('StepIndicator', () => {
  it('renders both step labels', async () => {
    render(await renderStepIndicator({ currentStep: 'currency' }));

    expect(screen.getByText('stepCurrency')).toBeTruthy();
    expect(screen.getByText('stepCategories')).toBeTruthy();
  });

  it('marks the current step with aria-current="step"', async () => {
    render(await renderStepIndicator({ currentStep: 'categories' }));

    const currentItem = screen.getByText('stepCategories').closest('li');

    expect(currentItem?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('stepCurrency').closest('li')?.getAttribute('aria-current')).toBeNull();
  });
});
