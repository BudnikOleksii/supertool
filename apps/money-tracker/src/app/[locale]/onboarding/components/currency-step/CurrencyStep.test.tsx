import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ComboboxOption } from '@supertool/ui/src/components/molecules/combobox/Combobox';

import { CurrencyStep } from './CurrencyStep';

const { updateDefaultCurrency, replace } = vi.hoisted(() => ({
  updateDefaultCurrency: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('../../../../../actions/update-default-currency', () => ({ updateDefaultCurrency }));

vi.mock('@supertool/next-shared/src/i18n/navigation/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}));

interface ComboboxMockProps {
  optionList: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}

vi.mock('@supertool/ui/src/components/molecules/combobox/Combobox', () => ({
  Combobox: ({ optionList, value, onValueChange, placeholder }: ComboboxMockProps) => (
    <select
      aria-label="currency"
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {optionList.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

describe('CurrencyStep', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation error and does not call the action on an empty submit', async () => {
    render(<CurrencyStep />);

    fireEvent.click(screen.getByRole('button', { name: 'continueButton' }));

    await screen.findByText('currencyRequired');
    expect(updateDefaultCurrency).not.toHaveBeenCalled();
  });

  it('pre-selects the saved currency when re-entering the step', () => {
    render(<CurrencyStep defaultCurrency="UAH" />);

    expect(screen.getByLabelText('currency')).toHaveProperty('value', 'UAH');
  });

  it('persists the currency and advances to the categories step on success', async () => {
    updateDefaultCurrency.mockResolvedValue({ status: 'success' });
    render(<CurrencyStep />);

    fireEvent.change(screen.getByLabelText('currency'), { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('button', { name: 'continueButton' }));

    await waitFor(() => {
      expect(updateDefaultCurrency).toHaveBeenCalledWith('USD');
    });
    expect(replace).toHaveBeenCalledWith('/onboarding?step=categories');
  });

  it('renders an action error and does not advance', async () => {
    updateDefaultCurrency.mockResolvedValue({ status: 'error', code: 'UNAUTHORIZED' });
    render(<CurrencyStep />);

    fireEvent.change(screen.getByLabelText('currency'), { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('button', { name: 'continueButton' }));

    await screen.findByText('UNAUTHORIZED');
    expect(replace).not.toHaveBeenCalled();
  });

  it('disables the continue button while the action is pending', async () => {
    updateDefaultCurrency.mockReturnValue(new Promise(() => undefined));
    render(<CurrencyStep />);

    fireEvent.change(screen.getByLabelText('currency'), { target: { value: 'USD' } });
    const continueButton = screen.getByRole('button', { name: 'continueButton' });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(continueButton).toHaveProperty('disabled', true);
    });
  });
});
